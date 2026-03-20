import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Type, Plus, Trash2, Save, AlignLeft, Tag, Bold, Italic, Underline, Image as ImageIcon, List, Palette, Eraser, ChevronDown, CaseUpper, Upload, Link as LinkIcon, ArrowLeft, Edit2, X, Eye, RotateCw, Check } from 'lucide-react';
import { generateFlashcardsFromText } from '../services/geminiService';
import { Deck, Flashcard } from '../types';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import CardBackDisplay from '../components/CardBackDisplay';
import { supabase } from '../lib/supabase';

const TEXT_COLORS = [
  { color: '#e2e8f0', label: 'Padrão (Cinza)' }, // Slate 200
  { color: '#2dd4bf', label: 'Destaque (Verde)' }, // Brand 400
  { color: '#f87171', label: 'Importante (Vermelho)' }, // Red 400
  { color: '#fbbf24', label: 'Atenção (Amarelo)' }, // Amber 400
  { color: '#60a5fa', label: 'Nota (Azul)' }, // Blue 400
  { color: '#a78bfa', label: 'Termo (Roxo)' }, // Purple 400
];

// --- Componente Auxiliar: Botão da Toolbar ---
const ToolbarButton = ({ 
  active, 
  onClick, 
  icon: Icon, 
  title 
}: { active?: boolean, onClick: () => void, icon: any, title: string }) => (
  <button 
    onMouseDown={(e) => e.preventDefault()} 
    onClick={onClick} 
    className={clsx(
      "p-1.5 rounded transition-all duration-200",
      active 
        ? "bg-slate-700 text-teal-400 shadow-inner ring-1 ring-slate-600" 
        : "text-slate-300 hover:text-white hover:bg-slate-700"
    )} 
    title={title}
  >
    <Icon size={14} strokeWidth={active ? 2.5 : 2} />
  </button>
);

// --- Componente Auxiliar: Editor WYSIWYG (Visual) ---
const RichTextEditor = ({ label, value, onChange, placeholder, height = "min-h-[120px]" }: any) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // States para menus
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showImageMenu, setShowImageMenu] = useState(false);
  
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const imageMenuRef = useRef<HTMLDivElement>(null);

  // Armazena a seleção atual para restaurar após upload de imagem
  const savedSelection = useRef<Range | null>(null);

  // Estado para o modo de digitação em Caixa Alta
  const [uppercaseMode, setUppercaseMode] = useState(false);

  // Estado para controlar quais botões estão ativos baseados na seleção
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    list: false,
    isSelectionUppercase: false, // Indica se a SELEÇÃO ATUAL é uppercase
    color: '#e2e8f0'
  });

  // Sincroniza o conteúdo do editor com o estado externo
  useEffect(() => {
    if (editorRef.current) {
        // Se o valor externo for diferente do interno E o editor NÃO tiver o foco (evita pular cursor), atualiza.
        // Isso permite carregar dados para edição.
        if (value !== editorRef.current.innerHTML && document.activeElement !== editorRef.current) {
            editorRef.current.innerHTML = value;
        }
    }
  }, [value]);

  // Fecha os popups ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
      if (imageMenuRef.current && !imageMenuRef.current.contains(event.target as Node)) {
        setShowImageMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Salva a posição do cursor (Range)
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      // Verifica se a seleção está dentro do editor atual
      if (editorRef.current && editorRef.current.contains(sel.anchorNode)) {
        savedSelection.current = sel.getRangeAt(0);
      }
    }
  };

  // Restaura a posição do cursor
  const restoreSelection = () => {
    const sel = window.getSelection();
    if (sel && savedSelection.current) {
      sel.removeAllRanges();
      sel.addRange(savedSelection.current);
    }
  };

  // Verifica quais formatações estão ativas na posição atual do cursor
  const checkFormats = () => {
    if (!document) return;
    
    const foreColor = document.queryCommandValue('foreColor');

    // Lógica para detectar se a SELEÇÃO está em Uppercase
    let isSelectionUpper = false;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
        const text = selection.toString();
        // Verifica se tem texto, se é igual à versão maiúscula E se contém letras
        if (text && text === text.toUpperCase() && text !== text.toLowerCase()) {
            isSelectionUpper = true;
        }
    }

    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      list: document.queryCommandState('insertUnorderedList'),
      isSelectionUppercase: isSelectionUpper,
      color: (foreColor && foreColor !== 'false') ? foreColor : '#e2e8f0'
    });
  };

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      onChange(html === '<br>' ? '' : html);
      checkFormats(); 
    }
  };

  // --- LÓGICA DE IMAGEM ---

  const insertImageHtml = (src: string) => {
    // 1. Garante que o editor tenha foco (Crucial para o execCommand funcionar)
    if (editorRef.current) {
        editorRef.current.focus();
    }

    // 2. Tenta restaurar a seleção salva. Se não existir, cria uma no final.
    if (savedSelection.current) {
        restoreSelection();
    } else if (editorRef.current) {
        // Fallback: Coloca o cursor no final do texto
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false); // false = fim, true = início
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    }
    
    const imgHtml = `<img src="${src}" class="rounded-lg max-h-48 mx-auto my-2 shadow-md border border-slate-700 block" />`;
    
    // 3. Insere a imagem
    document.execCommand('insertHTML', false, imgHtml);
    
    handleInput();
    setShowImageMenu(false);
  };

  // 1. Upload de Arquivo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          insertImageHtml(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
    // Limpa o input para permitir selecionar o mesmo arquivo novamente se necessário
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 2. URL Externa
  const handleUrlInput = () => {
    const url = prompt("Cole a URL da imagem:");
    if (url) {
      insertImageHtml(url);
    }
    setShowImageMenu(false);
  };

  // 3. Colar da Área de Transferência (Paste)
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // Verifica se há arquivos na área de transferência
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        e.preventDefault(); // Impede o comportamento padrão de colar
        
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            // Executa insertHTML manualmente (aqui não precisa de foco explícito pois já estamos no evento paste)
            const imgHtml = `<img src="${event.target.result}" class="rounded-lg max-h-48 mx-auto my-2 shadow-md border border-slate-700 block" />`;
            document.execCommand('insertHTML', false, imgHtml);
            handleInput();
          }
        };
        reader.readAsDataURL(file);
      }
    }
    // Se for texto, deixa o comportamento padrão acontecer
  };

  // Intercepta a digitação para aplicar Caixa Alta se o modo estiver ativo
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Se o modo estiver ATIVO, e a tecla for uma letra simples (não atalhos com Ctrl/Meta)
    if (uppercaseMode && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
        const upper = e.key.toUpperCase();
        if (e.key !== upper) {
            e.preventDefault();
            document.execCommand('insertText', false, upper);
            handleInput();
        }
    }
    setTimeout(checkFormats, 0); 
  };

  const execCmd = (command: string, arg: string | undefined = undefined) => {
    document.execCommand(command, false, arg);
    handleInput();
    checkFormats();
  };

  const handleUppercaseClick = () => {
    const selection = window.getSelection();
    
    if (selection && !selection.isCollapsed) {
        const text = selection.toString();
        if (text) {
            const newText = activeFormats.isSelectionUppercase ? text.toLowerCase() : text.toUpperCase();
            document.execCommand('insertText', false, newText);
            handleInput();
        }
    } else {
        setUppercaseMode(!uppercaseMode);
    }
    
    if (editorRef.current) {
        editorRef.current.focus();
    }
    checkFormats();
  };

  const handleColorSelect = (color: string) => {
      execCmd('foreColor', color);
      setShowColorPicker(false);
  };

  return (
    <div className="flex flex-col gap-2 group relative z-0">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2">
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider group-focus-within:text-teal-400 transition-colors">{label}</label>
        
        <div className="flex flex-wrap items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700 shadow-sm opacity-100 sm:opacity-90 sm:hover:opacity-100 transition-opacity w-full sm:w-auto">
          
          <ToolbarButton 
            active={activeFormats.bold} 
            onClick={() => execCmd('bold')} 
            icon={Bold} 
            title="Negrito" 
          />
          <ToolbarButton 
            active={activeFormats.italic} 
            onClick={() => execCmd('italic')} 
            icon={Italic} 
            title="Itálico" 
          />
          <ToolbarButton 
            active={activeFormats.underline} 
            onClick={() => execCmd('underline')} 
            icon={Underline} 
            title="Sublinhado" 
          />

          <ToolbarButton 
            active={uppercaseMode || activeFormats.isSelectionUppercase}
            onClick={handleUppercaseClick} 
            icon={CaseUpper} 
            title="Caixa Alta (Alternar Modo ou Seleção)" 
          />
          
          <div className="w-[1px] h-4 bg-slate-600 mx-1 hidden sm:block"></div>
          
          <ToolbarButton 
            active={activeFormats.list} 
            onClick={() => execCmd('insertUnorderedList')} 
            icon={List} 
            title="Lista" 
          />
          
          {/* Color Picker Dropdown */}
          <div className="relative" ref={colorPickerRef}>
              <button 
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowColorPicker(!showColorPicker)} 
                className={clsx(
                    "p-1.5 hover:bg-slate-700 rounded transition-colors flex items-center gap-1",
                    showColorPicker ? "text-white bg-slate-700 shadow-inner ring-1 ring-slate-600" : "text-slate-300 hover:text-white"
                )}
                title="Cor do Texto"
              >
                <Palette size={14} />
                <div 
                    className="w-2.5 h-2.5 rounded-full border border-slate-500 shadow-sm transition-colors duration-200"
                    style={{ backgroundColor: activeFormats.color }}
                />
                <ChevronDown size={10} className="opacity-70" />
              </button>

              {showColorPicker && (
                  <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-slate-700 shadow-xl rounded-lg p-2 z-50 w-32 grid grid-cols-3 gap-2">
                      {TEXT_COLORS.map((tc) => (
                          <button
                            key={tc.color}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleColorSelect(tc.color)}
                            className="w-8 h-8 rounded-full border border-slate-600 hover:border-white transition-all hover:scale-110"
                            style={{ backgroundColor: tc.color }}
                            title={tc.label}
                          />
                      ))}
                  </div>
              )}
          </div>

          <button 
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execCmd('removeFormat')} 
            className="p-1.5 hover:bg-slate-700 rounded text-slate-500 hover:text-red-400 transition-colors" 
            title="Limpar Formatação"
          >
            <Eraser size={14} />
          </button>

           <div className="w-[1px] h-4 bg-slate-600 mx-1 hidden sm:block"></div>
           
           {/* Image Menu Dropdown */}
           <div className="relative" ref={imageMenuRef}>
             {/* CRUCIAL FIX: Input de arquivo movido para FORA do render condicional para não ser desmontado */}
             <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileUpload}
             />
             
             <button 
                onMouseDown={(e) => {
                  e.preventDefault(); 
                  saveSelection(); // Salva onde estava o cursor
                }}
                onClick={() => setShowImageMenu(!showImageMenu)} 
                className={clsx(
                    "p-1.5 hover:bg-slate-700 rounded transition-colors flex items-center gap-1",
                    showImageMenu ? "text-white bg-slate-700 shadow-inner ring-1 ring-slate-600" : "text-slate-300 hover:text-white"
                )}
                title="Inserir Imagem (Upload ou URL)"
              >
                <ImageIcon size={14} />
                <ChevronDown size={10} className="opacity-70" />
              </button>

              {showImageMenu && (
                  <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-slate-700 shadow-xl rounded-lg overflow-hidden z-50 w-40 flex flex-col">
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                           // Abre a janela de arquivo
                           fileInputRef.current?.click(); 
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-left w-full"
                      >
                         <Upload size={12} />
                         Upload do PC
                      </button>
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleUrlInput}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-left w-full border-t border-slate-700"
                      >
                         <LinkIcon size={12} />
                         Colar Link (URL)
                      </button>
                  </div>
              )}
           </div>

        </div>
      </div>
      
      <div 
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste} // Intercepta Ctrl+V de imagens
        onKeyUp={checkFormats}
        onMouseUp={checkFormats}
        className={`w-full bg-slate-950 border border-slate-700 rounded-lg p-4 ${height} text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent focus:outline-none resize-y overflow-auto prose prose-invert prose-sm max-w-none custom-scrollbar cursor-text empty:before:content-[attr(data-placeholder)] empty:before:text-slate-600`}
        data-placeholder={placeholder}
        spellCheck={false}
      />
      <div className="text-[10px] text-slate-500 px-1">
        Dica: Você pode colar imagens diretamente aqui (Ctrl+V) ou arrastar arquivos.
      </div>
    </div>
  )
}

export const CardCreator: React.FC = () => {
  const navigate = useNavigate();
  // deckId e cardId podem vir da URL
  const { deckId, cardId } = useParams<{ deckId: string, cardId: string }>();
  
  const [targetDeck, setTargetDeck] = useState<Deck | null>(null);
  const [loadingDeck, setLoadingDeck] = useState(false);
  
  // Modos de operação: 
  // 1. Criando Deck (isEditing = false)
  // 2. Adicionando ao Deck (isEditing = true, !isSingleCardEdit)
  // 3. Editando Card Existente (isSingleCardEdit = true)
  const isAddingToDeck = !!deckId && !cardId;
  const isSingleCardEdit = !!deckId && !!cardId;

  const [mode, setMode] = useState<'manual' | 'ai'>('manual'); // Default para manual se estiver editando
  const [loading, setLoading] = useState(false);
  
  // Shared State
  const [deckTitle, setDeckTitle] = useState('');

  // AI State
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');

  // Manual State
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [manualCards, setManualCards] = useState<Partial<Flashcard>[]>([]);
  
  // Current Card Input State
  const [frontInput, setFrontInput] = useState('');
  const [backInput, setBackInput] = useState('');

  // Edit Mode & Preview State
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFlipped, setPreviewFlipped] = useState(false);

  // Focus ref para scrollar ao editor quando clicar em editar
  const editorContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchDeck() {
      if (deckId) {
        setLoadingDeck(true);
        const { data, error } = await supabase
          .from('decks_template')
          .select('*')
          .eq('id', deckId)
          .single();
          
        if (!error && data) {
          setTargetDeck(data as any); // We only need basic info like title
          
          if (isSingleCardEdit) {
            // Fetch specific card
            const { data: cardData, error: cardError } = await supabase
              .from('flashcards_template')
              .select('*')
              .eq('id', cardId)
              .single();
              
            if (!cardError && cardData) {
              setFrontInput(cardData.front);
              setBackInput(cardData.back);
              setMode('manual');
            } else {
              alert("Card não encontrado");
              navigate(`/deck/${deckId}`);
            }
          } else {
            // Modo Adicionar ao Deck: Apenas preenche tópico
            const cleanTopic = data.title.includes(':')
                ? data.title.split(':')[1].trim()
                : data.title;
            setTopic(cleanTopic);
            setMode('ai'); // Default AI
          }
        }
        setLoadingDeck(false);
      }
    }
    fetchDeck();
  }, [deckId, cardId, isSingleCardEdit, navigate]);

  const handleAiGenerate = async () => {
    if (!topic || !context) return;
    setLoading(true);
    try {
      const generatedCardsData = await generateFlashcardsFromText(topic, context);
      
      const newCards = generatedCardsData.map((c: any) => ({
          deck_id: isAddingToDeck ? deckId : null, // Será preenchido corretamente no create
          front: c.front,
          back: c.back,
          type: 'basic',
      }));

      if (isAddingToDeck && deckId) {
          // MODO ADICIONAR AO DECK EXISTENTE
          const { error } = await supabase.from('flashcards_template').insert(newCards);
          if (error) throw error;
          navigate(`/deck/${deckId}`);
      } else {
          // MODO CRIAR NOVO DECK
          const tagsArray = ['IA-Gerado', 'Medicina', topic.split(' ')[0]];
          
          const { data: newDeck, error: deckError } = await supabase.from('decks_template').insert({
            title: deckTitle || topic,
            description: `Gerado a partir de: ${topic}`,
            icon: '🩺',
            tags: tagsArray,
            is_folder: false
          }).select().single();
          
          if (deckError) throw deckError;
          
          // Insert cards with new deck ID
          const cardsWithDeckId = newCards.map((c: any) => ({ ...c, deck_id: newDeck.id }));
          const { error: cardsError } = await supabase.from('flashcards_template').insert(cardsWithDeckId);
          
          if (cardsError) throw cardsError;
          
          navigate('/library');
      }

    } catch (error) {
      alert("Falha ao gerar cards. Verifique sua chave API ou tente novamente.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Helper para validar conteúdo HTML
  const hasContent = (html: string) => {
     if (!html) return false;
     const clean = html.replace(/<[^>]*>/g, '').trim();
     return clean.length > 0 || html.includes('<img');
  };

  const handleAddOrUpdateManualCard = () => {
    // Validação estrita
    if (!hasContent(frontInput) || !hasContent(backInput)) return;

    if (editingCardId) {
        // Atualizar card existente na lista temporária
        setManualCards(prev => prev.map(c => 
            c.id === editingCardId 
            ? { ...c, front: frontInput, back: backInput }
            : c
        ));
        setEditingCardId(null);
    } else {
        // Adicionar novo card à lista temporária
        const newCard: Partial<Flashcard> = {
            id: crypto.randomUUID(), 
            front: frontInput,
            back: backInput
        };
        setManualCards([...manualCards, newCard]);
    }

    // Limpar
    setFrontInput('');
    setBackInput('');
  };

  const handleEditCard = (card: Partial<Flashcard>) => {
      setFrontInput(card.front || '');
      setBackInput(card.back || '');
      setEditingCardId(card.id || null);
      
      // Scroll to editor
      editorContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCancelEdit = () => {
      setEditingCardId(null);
      setFrontInput('');
      setBackInput('');
  };

  const handleRemoveManualCard = (id: string) => {
      if (editingCardId === id) handleCancelEdit();
      setManualCards(manualCards.filter(c => c.id !== id));
  };

  const handleSaveManualDeck = async () => {
      // 1. MODO EDIÇÃO ÚNICA (Salvar alteração de um card existente)
      if (isSingleCardEdit && cardId) {
           if (!hasContent(frontInput) || !hasContent(backInput)) {
               alert("Preencha frente e verso.");
               return;
           }
           setLoading(true);
           try {
               const { error, data, count } = await supabase
                 .from('flashcards_template')
                 .update({ front: frontInput, back: backInput })
                 .eq('id', cardId)
                 .select();
                 
               console.log("Update result:", { error, data, count, cardId, frontInput, backInput });
                 
               if (error) throw error;
               if (!data || data.length === 0) {
                   console.warn("No rows updated. RLS issue or invalid ID?");
                   alert("Erro ao salvar: Card não encontrado ou sem permissão.");
               } else {
                   navigate(`/deck/${deckId}`, { state: { selectedCardId: cardId } }); // Voltar para o detalhe do deck
               }
           } catch (e) {
               console.error(e);
               alert("Erro ao salvar card.");
           } finally {
               setLoading(false);
           }
           return;
      }

      // 2. MODO CRIAÇÃO / ADIÇÃO
      if (!isAddingToDeck && !deckTitle.trim()) {
          alert("Por favor, dê um título ao deck.");
          return;
      }

      // Auto-salva o card atual se o usuário esqueceu de clicar em "Adicionar" ou "Atualizar"
      let finalCards = [...manualCards];
      if (hasContent(frontInput) && hasContent(backInput)) {
          if (editingCardId) {
              finalCards = finalCards.map(c => 
                  c.id === editingCardId 
                  ? { ...c, front: frontInput, back: backInput }
                  : c
              );
          } else {
              finalCards.push({
                  id: crypto.randomUUID(), 
                  front: frontInput,
                  back: backInput
              });
          }
      }

      if (finalCards.length === 0) {
          alert("Adicione pelo menos 1 card.");
          return;
      }

      setLoading(true);

      try {
        if (isAddingToDeck && deckId) {
             const cardsToAdd = finalCards.map(c => ({
                deck_id: deckId,
                front: c.front!,
                back: c.back!,
                type: 'basic'
             }));
             const { error } = await supabase.from('flashcards_template').insert(cardsToAdd);
             if (error) throw error;
             navigate(`/deck/${deckId}`);

        } else {
            const tagsArray = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
            if (tagsArray.length === 0) tagsArray.push('Manual');

            const { data: newDeck, error: deckError } = await supabase.from('decks_template').insert({
                title: deckTitle,
                description: description || "Deck criado manualmente.",
                icon: '📝',
                tags: tagsArray,
                is_folder: false
            }).select().single();
            
            if (deckError) throw deckError;

            const cardsToAdd = finalCards.map(c => ({
                deck_id: newDeck.id,
                front: c.front!,
                back: c.back!,
                type: 'basic'
            }));
            
            const { error: cardsError } = await supabase.from('flashcards_template').insert(cardsToAdd);
            if (cardsError) throw cardsError;

            navigate('/library');
        }
      } catch (e) {
        console.error(e);
        alert("Erro ao salvar dados.");
      } finally {
        setLoading(false);
      }
  };

  const openPreview = () => {
      setPreviewFlipped(false);
      setShowPreview(true);
  };

  // Cálculo de validação para o botão "Adicionar à Lista"
  const isFormValid = hasContent(frontInput) && hasContent(backInput);

  if (loadingDeck) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 relative">
      
      {/* --- PREVIEW MODAL --- */}
      <AnimatePresence>
        {showPreview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
                <div className="relative w-full max-w-md">
                     <button 
                        onClick={() => setShowPreview(false)}
                        className="absolute -top-12 right-0 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full"
                     >
                         <X size={24} />
                     </button>
                     
                     <div className="text-center mb-4 text-slate-400 text-sm font-medium uppercase tracking-widest">
                        Pré-visualização
                     </div>

                     {/* Reusing Study Mode Card Look */}
                     <div className="perspective-1000 h-[400px] w-full cursor-pointer group" onClick={() => setPreviewFlipped(!previewFlipped)}>
                        <motion.div
                            className="w-full h-full relative"
                            initial={{ rotateY: 0 }}
                            animate={{ rotateY: previewFlipped ? 180 : 0 }}
                            transition={{ type: "spring", stiffness: 200, damping: 25 }}
                            style={{ transformStyle: 'preserve-3d' }}
                        >
                            {/* FRONT */}
                            <div 
                                className="absolute inset-0 bg-slate-900 rounded-3xl p-6 flex flex-col items-center border border-slate-800 shadow-2xl overflow-hidden"
                                style={{ backfaceVisibility: 'hidden' }}
                            >
                                <div className="absolute top-4 flex items-center gap-2 text-teal-400/80 z-10">
                                    <span className="text-xs font-bold uppercase tracking-widest">Questão</span>
                                </div>
                                <div className="relative z-10 w-full h-full pt-14 pb-8 overflow-y-auto custom-scrollbar flex flex-col items-start px-2">
                                    <div 
                                        className="w-full text-left prose prose-invert prose-base max-w-none break-words [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:mx-auto [&_img]:shadow-md [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_li]:mb-1" 
                                        dangerouslySetInnerHTML={{ __html: frontInput || '<p class="text-slate-500 italic">Vazio</p>' }}
                                    ></div>
                                </div>
                                <div className="absolute bottom-4 flex flex-col items-center gap-1 text-slate-500 opacity-60 z-10 left-0 right-0 pointer-events-none">
                                    <RotateCw size={16} />
                                </div>
                            </div>

                            {/* BACK */}
                            <div 
                                className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-900 rounded-3xl flex flex-col items-center border border-slate-700/50 shadow-2xl overflow-hidden"
                                style={{ transform: "rotateY(180deg)", backfaceVisibility: 'hidden' }}
                            >
                                <div className="w-full bg-slate-950/30 border-b border-slate-800/50 p-4 flex items-center justify-center relative shrink-0 z-10">
                                   <div className="flex items-center gap-2 text-emerald-400">
                                      <span className="text-xs font-bold uppercase tracking-widest">Resposta</span>
                                   </div>
                                </div>
                                <div className="relative z-10 w-full h-full pt-4 pb-6 overflow-y-auto custom-scrollbar flex flex-col items-start px-6">
                                    <div 
                                        className="w-full text-left prose prose-invert prose-base max-w-none break-words [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:mx-auto [&_img]:shadow-md [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_li]:mb-1" 
                                        dangerouslySetInnerHTML={{ __html: backInput || '<p class="text-slate-500 italic">Vazio</p>' }}
                                    ></div>
                                </div>
                            </div>
                        </motion.div>
                     </div>

                     <div className="mt-6 flex justify-center gap-3">
                         <button 
                            onClick={() => setShowPreview(false)}
                            className="flex items-center gap-2 bg-slate-800 text-slate-300 px-6 py-2 rounded-full font-medium hover:bg-slate-700 transition-colors"
                         >
                             <X size={16} />
                             Fechar
                         </button>
                         <button 
                            onClick={() => setPreviewFlipped(!previewFlipped)}
                            className="flex items-center gap-2 bg-teal-600 text-white px-6 py-2 rounded-full font-medium hover:bg-teal-500 transition-colors shadow-lg shadow-teal-900/20"
                         >
                             <RotateCw size={16} />
                             Virar Card
                         </button>
                     </div>
                </div>
            </div>
        )}
      </AnimatePresence>


      <div className="flex items-center gap-2 mb-6">
        {(isAddingToDeck || isSingleCardEdit) && (
            <button 
                onClick={() => {
                    if (targetDeck && isSingleCardEdit) {
                        navigate(`/deck/${targetDeck.id}`, { state: { scrollToCardId: cardId } });
                    } else if (targetDeck) {
                        navigate(`/deck/${targetDeck.id}`);
                    } else {
                        navigate(-1);
                    }
                }} 
                className="p-2 -ml-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
            >
                <ArrowLeft size={24} />
            </button>
        )}
        <h1 className="text-2xl font-bold text-white">
            {isSingleCardEdit ? 'Editar Card' : (isAddingToDeck ? `Adicionar ao Deck: ${targetDeck?.title}` : 'Criar Novo Deck')}
        </h1>
      </div>

      {/* Mode Switcher - Ocultar se estiver editando card específico */}
      {!isSingleCardEdit && (
        <div className="bg-slate-900 p-1 rounded-xl flex border border-slate-800 mb-6">
            <button 
            onClick={() => setMode('ai')}
            className={clsx(
                "flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all",
                mode === 'ai' ? "bg-teal-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
            )}
            >
            <Sparkles size={16} /> IA Médica
            </button>
            <button 
            onClick={() => setMode('manual')}
            className={clsx(
                "flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all",
                mode === 'manual' ? "bg-slate-700 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
            )}
            >
            <Type size={16} /> Editor Manual
            </button>
        </div>
      )}

      {/* Shared Title Input - SÓ MOSTRA SE NÃO ESTIVER EDITANDO OU ADICIONANDO A DECK EXISTENTE */}
      {!isAddingToDeck && !isSingleCardEdit && (
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título do Deck</label>
            <input 
            type="text" 
            value={deckTitle}
            onChange={(e) => setDeckTitle(e.target.value)}
            placeholder={mode === 'ai' ? "Ex: Anatomia Cardíaca" : "Ex: Farmacologia - Antibióticos"}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-teal-500 focus:outline-none placeholder-slate-600 font-medium"
            />
          </div>
      )}

      {mode === 'ai' ? (
        <div className="space-y-4 animate-in slide-in-from-left-4">
          <div className="bg-teal-900/20 border border-teal-500/30 p-4 rounded-xl">
            <div className="flex items-start gap-3">
              <Sparkles className="text-teal-400 shrink-0 mt-1" size={20} />
              <div>
                <h3 className="text-teal-100 font-medium text-sm">Professor IA</h3>
                <p className="text-teal-200/60 text-xs mt-1">
                  Cole suas anotações, um artigo ou resumo de aula. Vou extrair os conceitos chaves e criar flashcards para sua prova de residência.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tópico / Especialidade</label>
            <input 
              type="text" 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ex: Fisiopatologia da Diabetes"
              disabled={isAddingToDeck}
              className={clsx(
                "w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-teal-500 focus:outline-none placeholder-slate-600",
                isAddingToDeck && "opacity-50 cursor-not-allowed bg-slate-800 text-slate-400"
              )}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Conteúdo / Contexto</label>
            <textarea 
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Cole o texto aqui..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 h-40 text-white focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none placeholder-slate-600"
            />
          </div>

          <button 
            onClick={handleAiGenerate}
            disabled={loading || !topic || !context || (!isAddingToDeck && !deckTitle)}
            className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-teal-900/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles size={20} /> {isAddingToDeck ? 'Gerar e Adicionar' : 'Gerar Deck com IA'}
              </>
            )}
          </button>
        </div>
      ) : (
        /* --- MANUAL MODE --- */
        <div className="space-y-6 animate-in slide-in-from-right-4">
            
            {/* Metadata Section - SÓ MOSTRA SE NÃO ESTIVER EDITANDO OU ADICIONANDO */}
            {!isAddingToDeck && !isSingleCardEdit && (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                            <AlignLeft size={12} /> Descrição (Opcional)
                        </label>
                        <input 
                            type="text" 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Ex: Resumo da aula do Dr. House"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-teal-500 focus:outline-none placeholder-slate-600"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                            <Tag size={12} /> Tags (Separe por vírgula)
                        </label>
                        <input 
                            type="text" 
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                            placeholder="Ex: Cardiologia, Emergência, USP"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-teal-500 focus:outline-none placeholder-slate-600"
                        />
                    </div>
                </div>
                <div className="border-t border-slate-800 my-4"></div>
                </>
            )}

            {/* Card Editor Section */}
            <div ref={editorContainerRef} className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6 shadow-sm relative">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        {isSingleCardEdit ? (
                             <>
                                <Edit2 size={18} className="text-teal-400" />
                                <span>Editando Card</span>
                             </>
                        ) : (
                            editingCardId ? (
                                <>
                                    <Edit2 size={18} className="text-orange-400" /> 
                                    <span className="text-orange-400">Editando da Lista</span>
                                </>
                            ) : (
                                <>
                                    <Plus size={18} className="text-teal-400" /> 
                                    <span>Adicionar Novo Card</span>
                                </>
                            )
                        )}
                    </h3>
                    {editingCardId && (
                         <button onClick={handleCancelEdit} className="text-xs text-slate-500 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-md">
                             <X size={12} /> Cancelar
                         </button>
                    )}
                </div>
                
                <div className="space-y-6">
                    <RichTextEditor 
                        label="Frente (Pergunta)" 
                        value={frontInput} 
                        onChange={setFrontInput} 
                        placeholder="Digite a pergunta aqui... (Pode usar negrito, cores, imagens)"
                    />
                    
                    <RichTextEditor 
                        label="Verso (Resposta)" 
                        value={backInput} 
                        onChange={setBackInput} 
                        placeholder="Digite a resposta correta aqui..."
                        height="min-h-[160px]"
                    />
                    
                    <div className="flex gap-2">
                        {/* Se for Single Edit (persitente), não mostra botão de adicionar à lista */}
                        {!isSingleCardEdit && (
                            <button 
                                onClick={handleAddOrUpdateManualCard}
                                disabled={!isFormValid}
                                className={clsx(
                                    "flex-1 py-3 font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
                                    editingCardId 
                                        ? "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20" 
                                        : "bg-slate-800 hover:bg-slate-700 text-teal-400 border-slate-700"
                                )}
                            >
                                {editingCardId ? (
                                    <><Check size={18} /> Atualizar na Lista</>
                                ) : (
                                    <><Plus size={18} /> Adicionar à Lista</>
                                )}
                            </button>
                        )}

                        <button
                             onClick={openPreview}
                             disabled={!isFormValid}
                             className={clsx(
                                "px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2",
                                isSingleCardEdit && "flex-1" // Em modo edição única, o preview ocupa metade
                             )}
                             title="Pré-visualizar como ficará no estudo"
                        >
                            <Eye size={20} />
                            <span className="hidden sm:inline">Preview</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview List (Só mostra se NÃO for edição única) */}
            {!isSingleCardEdit && manualCards.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wide flex justify-between items-center">
                        <span>Cards Criados ({manualCards.length})</span>
                    </h3>
                    
                    <div className="space-y-2">
                        {manualCards.map((card, idx) => (
                            <div key={card.id || idx} className={clsx(
                                "border p-4 rounded-lg flex items-start justify-between group transition-colors",
                                editingCardId === card.id 
                                    ? "bg-orange-500/5 border-orange-500/30" 
                                    : "bg-slate-900 border border-slate-800 hover:border-slate-700"
                            )}>
                                <div className="flex-1 mr-4 overflow-hidden">
                                    <div className="flex gap-2 mb-1">
                                        <span className="text-teal-500 font-bold text-xs mt-1 shrink-0">P:</span>
                                        <div className="text-sm text-white prose prose-invert prose-sm max-w-none line-clamp-2" dangerouslySetInnerHTML={{ __html: card.front || '' }}></div>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="text-slate-600 font-bold text-xs mt-1 shrink-0">R:</span>
                                        <CardBackDisplay 
                                          content={card.back || ''} 
                                          className="text-sm text-slate-400 prose-sm line-clamp-2" 
                                          hideExtra={true} 
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={() => handleEditCard(card)}
                                        className="p-2 text-slate-500 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
                                        title="Editar"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleRemoveManualCard(card.id!)}
                                        className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Remover"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Save Button */}
            <div className="pt-4">
                <button 
                    onClick={handleSaveManualDeck}
                    disabled={(!isSingleCardEdit && (manualCards.length === 0 && (!hasContent(frontInput) || !hasContent(backInput))) || (!isAddingToDeck && !isSingleCardEdit && !deckTitle.trim())) || loading}
                    className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-teal-900/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                     {loading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Salvando...
                        </>
                    ) : (
                        isSingleCardEdit ? (
                             <><Save size={20} /> Salvar Alterações do Card</>
                        ) : (
                             <><Save size={20} /> {isAddingToDeck ? `Salvar no Deck (${manualCards.length})` : `Salvar Deck (${manualCards.length})`}</>
                        )
                    )}
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default CardCreator;
