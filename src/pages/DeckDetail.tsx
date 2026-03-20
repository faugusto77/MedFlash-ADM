import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Play, Layers, BarChart, PlusCircle, Eye, Edit2, Trash2, X, RotateCw, Lightbulb, Brain, ChevronLeft, Search, CheckCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { AppState, Flashcard, Deck } from '../types';
import { getDeckCoverImage, FALLBACK_IMAGE } from '../utils/imageMapping';
import { calculateCBL, calculateDeckMastery } from '../utils/cbl';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import CardBackDisplay from '../components/CardBackDisplay';
import { supabase } from '../lib/supabase';

// Helper para mapear confiança para cores
const getConfidenceColor = (confidence?: number) => {
  switch (confidence) {
    case 1: return 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]'; // Não Sei
    case 2: return 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]'; // Difícil
    case 3: return 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.4)]'; // Médio
    case 4: return 'bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.4)]'; // Bom
    case 5: return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]'; // Dominei
    default: return 'bg-slate-800'; // Novo/Sem revisão
  }
};

// Helper para estilo dinâmico de borda baseado na confiança atual
const getCardStyle = (confidence?: number) => {
  switch (confidence) {
    case 1: return 'border-2 border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.25)]'; // Errei
    case 2: return 'border-2 border-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.25)]'; // Difícil
    case 3: return 'border-2 border-yellow-500 shadow-[0_0_25px_rgba(234,179,8,0.25)]'; // Médio
    case 4: return 'border-2 border-teal-500 shadow-[0_0_25px_rgba(20,184,166,0.25)]'; // Bom
    case 5: return 'border-2 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.25)]'; // Fácil
    default: return 'border border-slate-700/60 shadow-2xl'; // Novo / Sem avaliação
  }
};

const RateButton = ({ value, label, color, textColor, onClick }: any) => {
    return (
        <button 
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-all active:scale-95 group relative overflow-hidden h-full"
        >
            <div className={`absolute top-0 left-0 w-full h-1 ${color} opacity-80`}></div>
            <span className={`font-bold text-xl md:text-2xl leading-none mb-1 ${textColor}`}>{value}</span>
            <span className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-tight">{label}</span>
        </button>
    )
};

export function DeckDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);

  // States para Modais
  const [previewCard, setPreviewCard] = useState<Flashcard | null>(null);
  const [isPreviewFlipped, setIsPreviewFlipped] = useState(false);
  const [previewMode, setPreviewMode] = useState<'view' | 'study'>('view');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewStartTime, setPreviewStartTime] = useState<number>(0);
  
  // State para Modal de Deleção
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValidation, setFilterValidation] = useState<'all' | 'validated' | 'not_validated'>('all');

  useEffect(() => {
    async function fetchDeckAndCards() {
      try {
        setLoading(true);
        // Attempt to fetch from Supabase
        const { data: deckData, error: deckError } = await supabase
          .from('decks_template')
          .select('*')
          .eq('id', id)
          .single();

        if (deckError) {
          console.error('Error fetching deck from Supabase:', deckError.message);
          return;
        }

        const { data: cardsData, error: cardsError } = await supabase
          .from('flashcards_template')
          .select('*')
          .eq('deck_id', id)
          .order('created_at', { ascending: true });

        if (cardsError) {
          console.error('Error fetching cards from Supabase:', cardsError.message);
        }

        if (deckData) {
          const mappedCards = (cardsData || []).map(c => ({
            ...c,
            frontImage: c.front_image,
            backImage: c.back_image,
            history: c.history || []
          }));

          const mappedDeck: Deck = {
            ...deckData,
            id: deckData.id,
            title: deckData.title || 'Sem Título',
            tags: Array.isArray(deckData.tags) ? deckData.tags : [],
            icon: deckData.icon || '📚',
            cards: mappedCards,
            stats: { 
              masteryPercentage: deckData.mastery_score || 0,
              totalReviews: 0
            }
          };
          setDeck(mappedDeck);
        }
      } catch (err) {
        console.error('Exception fetching from Supabase:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDeckAndCards();
  }, [id]);

  // Sincronização em Tempo Real (CORREÇÃO DE IMAGENS)
  // Se o 'deck' (prop) atualizar vindo do App.tsx (ex: imagens carregadas via sync),
  // forçamos a atualização do 'previewCard' aberto para mostrar a imagem imediatamente.
  useEffect(() => {
    if (previewCard && deck) {
        const updatedCard = deck.cards.find(c => c.id === previewCard.id);
        if (updatedCard) {
            // Se houve mudança nas imagens ou texto, atualiza o estado do modal
            if (
                updatedCard.frontImage !== previewCard.frontImage || 
                updatedCard.backImage !== previewCard.backImage ||
                updatedCard.front !== previewCard.front || 
                updatedCard.back !== previewCard.back
            ) {
                setPreviewCard(updatedCard);
            }
        }
    }
  }, [deck, previewCard]); // Dependência em decks/deck garante re-execução na atualização

  // Abrir ou rolar para o card selecionado ao retornar da edição
  useEffect(() => {
    const state = location.state as { selectedCardId?: string, scrollToCardId?: string };
    
    if (state?.selectedCardId && deck) {
      const card = deck.cards.find(c => c.id === state.selectedCardId);
      if (card) {
        setPreviewCard(card);
        setPreviewMode('view');
        setIsPreviewFlipped(false);
        // Limpa o estado para não reabrir ao recarregar a página
        navigate(location.pathname, { replace: true, state: {} });
      }
    } else if (state?.scrollToCardId && deck) {
      // Rolar para o card instantaneamente
      setTimeout(() => {
        const element = document.getElementById(`card-${state.scrollToCardId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      }, 10);
      // Limpa o estado
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, deck, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (!deck) return <div className="p-8 text-center text-slate-500">Deck não encontrado</div>;

  // Logic to rename specific decks for display
  let displayTitle = deck.title;
  if (displayTitle === 'HAS (Completo)') {
      displayTitle = 'Cardiologia: HAS';
  } else if (displayTitle === 'HAS') {
      // Fallback if it was already renamed to HAS in other contexts but we want the full category here
      displayTitle = 'Cardiologia: HAS';
  }

  // Calculate Daily Progress from Stats
  const today = new Date().toISOString().split('T')[0];
  const lastSession = deck.stats.lastSession;
  let dailyProgress = 0;
  
  if (lastSession && lastSession.date === today && lastSession.totalCards > 0) {
     dailyProgress = Math.round((lastSession.completedCards / lastSession.totalCards) * 100);
     if (dailyProgress > 100) dailyProgress = 100;
  }

  // Cálculos para exibição
  const totalCards = deck.cards.length;
  const validatedCards = deck.cards.filter(c => c.is_validated).length;
  const notValidatedCards = totalCards - validatedCards;
  const validatedPercentage = totalCards > 0 ? (validatedCards / totalCards) * 100 : 0;

  const chartData = [
      { name: 'Validados', value: validatedCards, color: '#4ade80' }, 
      { name: 'Não Validados', value: notValidatedCards, color: '#1e293b' }
  ].filter(d => d.value > 0); 
  
  if (totalCards === 0) {
      chartData.push({ name: 'Vazio', value: 1, color: '#1e293b' });
  }

  const handleOpenStudy = (card: Flashcard) => {
      setPreviewCard(card);
      setPreviewMode('study');
      setIsPreviewFlipped(false);
      setPreviewStartTime(Date.now());
  };

  const handleOpenView = (card: Flashcard) => {
      setPreviewCard(card);
      setPreviewMode('view');
      setIsPreviewFlipped(false);
  };

  const handleRate = async (confidence: 1 | 2 | 3 | 4 | 5) => {
      if (!previewCard || isProcessing) return;
      setIsProcessing(true);

      try {
        const duration = Math.floor((Date.now() - previewStartTime) / 1000);
        const updatedStats = calculateCBL(previewCard, confidence);
        
        const newHistoryLog = {
            date: new Date().toISOString(),
            quality: confidence,
            duration: duration
        };

        const newCard = { 
            ...previewCard, 
            ...updatedStats,
            history: [...(previewCard.history || []), newHistoryLog]
        };

        const allCards = deck.cards.map(c => c.id === newCard.id ? newCard : c);
        const masteryPercentage = calculateDeckMastery(allCards);
        
        const prevCompleted = (deck.stats.lastSession?.date === today ? deck.stats.lastSession.completedCards : 0);
        
        const newDeckStats = {
            ...deck.stats,
            totalReviews: deck.stats.totalReviews + 1,
            masteryPercentage: masteryPercentage || 0,
            lastSession: {
                date: today,
                totalCards: deck.stats.lastSession?.totalCards || deck.cards.length,
                completedCards: prevCompleted + 1
            },
            lastPlayedAt: new Date().toISOString()
        };

        // Note: We don't save progress to the template tables in the admin app.
        // The study mode here is just for previewing the card behavior.
        
        // Update local state
        setDeck({
          ...deck,
          cards: allCards,
          stats: newDeckStats
        });
        
        // Fecha o modal e volta para a tela de detalhes do deck
        closePreview(); 
      } catch (e) {
          console.error("Error rating card", e);
          alert("Erro ao salvar progresso.");
      } finally {
          setIsProcessing(false);
      }
  };

  const closePreview = () => {
      if (previewCard) {
          const cardId = previewCard.id;
          setPreviewCard(null);
          setTimeout(() => {
              const element = document.getElementById(`card-${cardId}`);
              if (element) {
                  element.scrollIntoView({ behavior: 'auto', block: 'center' });
              }
          }, 10);
      } else {
          setPreviewCard(null);
      }
  };

  // Abre o Modal de Confirmação
  const handleDeleteClick = (e: React.MouseEvent, cardId: string) => {
      e.stopPropagation(); // Impede abrir o card
      setCardToDelete(cardId);
  };

  // Executa a exclusão real
  const confirmDelete = async () => {
      if (cardToDelete) {
          try {
            await supabase
              .from('flashcards_template')
              .delete()
              .eq('id', cardToDelete);
              
            setDeck({
              ...deck,
              cards: deck.cards.filter(c => c.id !== cardToDelete)
            });
          } catch (e) {
            console.error("Error deleting card", e);
          }
          setCardToDelete(null);
      }
  };

  const handleValidateCard = async (e: React.MouseEvent, card: Flashcard) => {
      e.stopPropagation();
      const newValidationState = !card.is_validated;
      
      try {
          const { error } = await supabase
              .from('flashcards_template')
              .update({ is_validated: newValidationState })
              .eq('id', card.id);
              
          if (error) throw error;
          
          setDeck({
              ...deck,
              cards: deck.cards.map(c => 
                  c.id === card.id ? { ...c, is_validated: newValidationState } : c
              )
          });
      } catch (e) {
          console.error("Error validating card", e);
          alert("Erro ao validar card.");
      }
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 pb-20">
      
      {/* --- MODAL DE CONFIRMAÇÃO DE EXCLUSÃO --- */}
      <AnimatePresence>
          {cardToDelete && (
              <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl relative"
                  >
                      <button 
                        onClick={() => setCardToDelete(null)}
                        className="absolute top-4 right-4 text-slate-500 hover:text-white"
                      >
                          <X size={20} />
                      </button>

                      <div className="flex flex-col items-center text-center">
                          <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                              <Trash2 size={24} className="text-red-500" />
                          </div>
                          <h3 className="text-xl font-bold text-white mb-2">Excluir Card?</h3>
                          <p className="text-slate-400 mb-6 text-sm">
                              Esta ação é irreversível e apagará o histórico de revisão deste card.
                          </p>
                          
                          <div className="flex gap-3 w-full">
                              <button 
                                  onClick={() => setCardToDelete(null)} 
                                  className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 transition-colors"
                              >
                                  Cancelar
                              </button>
                              <button 
                                  onClick={confirmDelete} 
                                  className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20"
                              >
                                  Sim, Excluir
                              </button>
                          </div>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {/* --- PREVIEW / STUDY MODAL (Centered & Aligned) --- */}
      <AnimatePresence>
        {previewCard && (
            <div className="fixed inset-0 z-[200] md:sticky md:inset-auto md:top-0 md:h-[100dvh] md:-mt-4 md:-mx-4 md:w-[calc(100%+2rem)] md:z-50 bg-slate-950 flex flex-col overflow-hidden items-center justify-center md:justify-between">
                 
                 {/* 1. Header Fixo e Alinhado */}
                 <div className="shrink-0 w-full max-w-2xl px-4 z-20 mb-1 md:mb-0 md:pt-4">
                    <div className="h-16 w-full flex justify-between items-center px-4 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl shadow-lg relative overflow-hidden">
                        <button 
                            onClick={closePreview}
                            className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-full transition-colors flex items-center gap-1"
                        >
                            {previewMode === 'view' ? <X size={20} /> : <ChevronLeft size={20} />}
                            <span className="text-sm font-medium">{previewMode === 'view' ? 'Fechar' : 'Voltar'}</span>
                        </button>
                        
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest mb-0.5">
                                {previewMode === 'study' ? 'Estudo Rápido' : 'Visualização'}
                            </span>
                            <span className="text-xs font-medium text-slate-200 line-clamp-1 max-w-[150px] md:max-w-[200px] text-center">
                                {displayTitle}
                            </span>
                        </div>
                        
                        <div className="w-16"></div> {/* Spacer for alignment */}
                    </div>
                 </div>

                 {/* 2. Área do Card (Tamanho Reduzido e Alinhado) */}
                 <div className="w-full max-w-2xl h-[55vh] md:h-full md:flex-1 flex flex-col items-center justify-center px-4 py-2 md:py-4 md:px-4 overflow-hidden relative z-10">
                     <div 
                        className="w-full h-full cursor-pointer group perspective-1000 relative flex flex-col"
                        onClick={() => !isProcessing && setIsPreviewFlipped(!isPreviewFlipped)}
                     >
                        <motion.div
                            className="w-full h-full relative"
                            initial={{ rotateY: 0, scale: 0.95, opacity: 0 }}
                            animate={{ rotateY: isPreviewFlipped ? 180 : 0, scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 25, mass: 1 }}
                            style={{ transformStyle: 'preserve-3d' }}
                        >
                            {/* FRONT (Frente) */}
                            <div 
                                className={clsx(
                                    "absolute inset-0 bg-slate-900 rounded-3xl flex flex-col overflow-hidden transition-all duration-300",
                                    getCardStyle(previewCard.confidence)
                                )}
                                style={{ backfaceVisibility: 'hidden' }}
                            >
                                {/* Header do Card */}
                                <div className="flex items-center gap-2 px-6 pt-6 pb-2 text-teal-400/80 shrink-0">
                                    <Brain size={18} />
                                    <span className="text-xs font-bold uppercase tracking-widest">Questão</span>
                                </div>
                                
                                {/* Conteúdo Scrollável do Card */}
                                <div className="flex-1 w-full overflow-y-auto custom-scrollbar px-6 pb-2">
                                     <div className="flex flex-col items-start min-h-full py-2">
                                         <div className="w-full my-auto">
                                            {previewCard.frontImage && (
                                                <div className="w-full flex justify-center mb-4 bg-black/20 rounded-lg p-2">
                                                    <img 
                                                    src={previewCard.frontImage} 
                                                    className="max-h-48 md:max-h-64 object-contain rounded shadow-sm" 
                                                    alt="Imagem da Questão"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                        if(e.currentTarget.parentElement) e.currentTarget.parentElement.style.display = 'none';
                                                    }}
                                                    />
                                                </div>
                                            )}
                                            <div 
                                                className={clsx(
                                                    "w-full text-left font-semibold text-white leading-relaxed select-none prose prose-invert max-w-none break-words", 
                                                    previewCard.frontImage ? "prose-base" : "prose-lg md:prose-xl"
                                                )}
                                                dangerouslySetInnerHTML={{ __html: previewCard.front }} 
                                            />
                                         </div>
                                     </div>
                                </div>
                                
                                <div className="shrink-0 h-12 flex items-center justify-center border-t border-slate-800/50 bg-slate-900/50 backdrop-blur-sm text-slate-500 gap-2">
                                    <span className="text-[10px] font-medium uppercase tracking-wider">Toque para Virar</span>
                                    <RotateCw size={12} />
                                </div>
                            </div>

                            {/* BACK (Verso) */}
                            <div 
                                className={clsx(
                                    "absolute inset-0 bg-slate-900 rounded-3xl flex flex-col overflow-hidden transition-all duration-300",
                                    getCardStyle(previewCard.confidence)
                                )}
                                style={{ transform: "rotateY(180deg)", backfaceVisibility: 'hidden' }}
                            >
                                <div className="w-full bg-slate-950/30 border-b border-slate-800/50 p-4 flex items-center justify-center shrink-0">
                                   <div className="flex items-center gap-2 text-emerald-400">
                                      <Lightbulb size={18} className="fill-current text-emerald-500/20" />
                                      <span className="text-xs font-bold uppercase tracking-widest">Resposta</span>
                                   </div>
                                </div>
                                <div className="flex-1 w-full overflow-y-auto custom-scrollbar px-6 py-4">
                                    <div className="flex flex-col items-start min-h-full">
                                        <div className="w-full my-auto">
                                            {previewCard.backImage && (
                                                <div className="w-full flex justify-center mb-4 bg-black/20 rounded-lg p-2">
                                                    <img 
                                                    src={previewCard.backImage} 
                                                    className="max-h-48 md:max-h-64 object-contain rounded shadow-sm" 
                                                    alt="Imagem da Resposta"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                        if(e.currentTarget.parentElement) e.currentTarget.parentElement.style.display = 'none';
                                                    }}
                                                    />
                                                </div>
                                            )}
                                            <div className="w-full text-left">
                                                <CardBackDisplay 
                                                    content={previewCard.back} 
                                                    className={clsx(
                                                        "text-slate-100 leading-relaxed font-medium", 
                                                        previewCard.backImage ? "prose-base" : "prose-lg"
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-1.5 w-full bg-gradient-to-r from-slate-800 via-emerald-900/20 to-slate-800 shrink-0"></div>
                            </div>
                        </motion.div>
                     </div>
                 </div>

                 {/* 3. Rodapé Fixo e Alinhado */}
                 <div className="shrink-0 w-full max-w-2xl px-4 z-20 mt-1 md:mt-0 md:pb-6">
                     <div className="w-full bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-lg p-3 md:p-4">
                        <div className="w-full h-14 md:h-16 flex items-center">
                        {previewMode === 'study' ? (
                            <AnimatePresence mode="wait">
                            {!isPreviewFlipped ? (
                                <motion.button
                                    key="show-btn"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    onClick={() => setIsPreviewFlipped(true)}
                                    className="w-full h-full bg-teal-600 hover:bg-teal-500 text-white text-lg font-bold rounded-xl shadow-lg shadow-teal-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                >
                                    <RotateCw size={24} /> Mostrar Resposta
                                </motion.button>
                            ) : (
                                <motion.div 
                                    key="rate-btns"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={clsx("grid grid-cols-5 gap-2 w-full h-full", isProcessing && "opacity-50 pointer-events-none")}
                                >
                                    <RateButton value={1} label="Errei" color="bg-rose-500" textColor="text-rose-400" onClick={() => handleRate(1)} />
                                    <RateButton value={2} label="Difícil" color="bg-orange-500" textColor="text-orange-400" onClick={() => handleRate(2)} />
                                    <RateButton value={3} label="Médio" color="bg-yellow-500" textColor="text-yellow-400" onClick={() => handleRate(3)} />
                                    <RateButton value={4} label="Bom" color="bg-teal-500" textColor="text-teal-400" onClick={() => handleRate(4)} />
                                    <RateButton value={5} label="Fácil" color="bg-emerald-500" textColor="text-emerald-400" onClick={() => handleRate(5)} />
                                </motion.div>
                            )}
                            </AnimatePresence>
                        ) : (
                            <div className="flex justify-center items-center h-full text-slate-500 text-xs w-full">
                                Toque no card para virar
                            </div>
                        )}
                        </div>
                     </div>
                 </div>
            </div>
        )}
      </AnimatePresence>

      {/* Header Page */}
      <button onClick={() => navigate(-1)} className="flex items-center text-slate-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft size={20} className="mr-1" /> Voltar
      </button>

      {/* Hero Deck Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 relative overflow-hidden group">
        <div className="absolute inset-0 z-0">
          <img 
            src={getDeckCoverImage(deck)} 
            alt={displayTitle}
            onError={(e) => {
              (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
            }}
            className="w-full h-full object-cover opacity-20 blur-sm group-hover:blur-0 group-hover:opacity-30 transition-all duration-700 transform group-hover:scale-105" 
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-slate-900/60"></div>
        </div>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex gap-4">
               <div className="w-16 h-16 bg-slate-800/80 backdrop-blur-sm rounded-xl flex items-center justify-center text-4xl shadow-inner shrink-0 border border-slate-700/50">
                  {deck.icon}
               </div>
               <div>
                 <h1 className="text-2xl font-bold text-white mb-2">{displayTitle}</h1>
                 <div className="flex flex-wrap gap-2 mt-1">
                    {deck.tags.map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-1 bg-slate-800/80 border border-slate-700 text-slate-300 rounded-full backdrop-blur-sm">
                            #{tag}
                        </span>
                    ))}
                 </div>
               </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Link 
                to={`/deck/${deck.id}/add`}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 border border-slate-700 transition-colors"
              >
                <PlusCircle size={20} /> 
                Adicionar Cards
              </Link>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8 mt-8 border-t border-slate-700/50 pt-6">
             <div className="flex items-center gap-6">
                 <div className="flex flex-col items-start min-w-[80px]">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Validados</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-light text-white tracking-tight leading-none">{validatedCards}</span>
                        <span className="text-sm font-medium text-slate-600">/{totalCards}</span>
                    </div>
                 </div>
                 <div className="w-px h-10 bg-slate-800 hidden md:block"></div>
                 <div className="flex items-center gap-3">
                     <div className="relative w-20 h-20">
                         <ResponsiveContainer width="100%" height="100%">
                             <PieChart margin={{ top: 0, left: 0, right: 0, bottom: 0 }}>
                                 <Pie
                                     data={chartData}
                                     cx="50%"
                                     cy="50%"
                                     innerRadius={25}
                                     outerRadius={33}
                                     paddingAngle={2} 
                                     dataKey="value"
                                     stroke="none"
                                     startAngle={90}
                                     endAngle={-270}
                                 >
                                     {chartData.map((entry, index) => (
                                         <Cell key={`cell-${index}`} fill={entry.color} />
                                     ))}
                                 </Pie>
                             </PieChart>
                         </ResponsiveContainer>
                         <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                             <span className="text-sm font-medium text-white leading-none">
                                 {validatedPercentage.toFixed(0)}%
                             </span>
                         </div>
                     </div>
                     <div className="flex flex-col">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Validação</span>
                         <span className="text-xs text-slate-500">Progresso</span>
                     </div>
                 </div>
             </div>

             {dailyProgress > 0 && (
                 <div className="md:ml-auto flex items-center gap-3 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50 self-end md:self-center w-full md:w-auto">
                    <BarChart size={16} className="text-emerald-400" />
                    <div className="flex flex-col w-full md:w-32">
                        <div className="flex justify-between text-[10px] font-bold text-emerald-400 mb-1">
                            <span>HOJE</span>
                            <span>{dailyProgress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${dailyProgress}%` }}></div>
                        </div>
                    </div>
                 </div>
             )}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 shrink-0">
          <Layers size={18} className="text-slate-400" />
          Conteúdo do Deck
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <select
            value={filterValidation}
            onChange={(e) => setFilterValidation(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all cursor-pointer"
          >
            <option value="all">Todos</option>
            <option value="validated">Validados</option>
            <option value="not_validated">Não Validados</option>
          </select>

          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar cards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
            />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {(() => {
          const filteredCards = deck.cards.filter(card => {
            const searchLower = searchTerm.toLowerCase();
            const frontText = card.front.replace(/<[^>]*>?/gm, '').toLowerCase();
            const backText = card.back.replace(/<[^>]*>?/gm, '').toLowerCase();
            const matchesSearch = frontText.includes(searchLower) || backText.includes(searchLower);
            
            if (filterValidation === 'validated') return matchesSearch && card.is_validated;
            if (filterValidation === 'not_validated') return matchesSearch && !card.is_validated;
            return matchesSearch;
          });

          if (filteredCards.length === 0) {
            return (
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl flex flex-col items-center justify-center text-center">
                <Search size={32} className="text-slate-600 mb-3" />
                <h3 className="text-slate-300 font-medium mb-1">Nenhum card encontrado</h3>
                <p className="text-slate-500 text-sm">Tente buscar com outras palavras-chave.</p>
              </div>
            );
          }

          return filteredCards.map((card, idx) => {
            const confidenceColor = getConfidenceColor(card.confidence);
            return (
              <div id={`card-${card.id}`} key={card.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex gap-4 hover:border-slate-700 transition-colors group relative overflow-hidden">
              <div 
                className={clsx(
                  "absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-300 group-hover:w-2",
                  card.is_validated ? "bg-green-400" : confidenceColor
                )}
                title={`Nível de Confiança: ${card.confidence || 0}`}
              ></div>
              <div className="text-slate-600 font-mono text-xs pt-1 w-6 ml-2 shrink-0">{idx + 1}</div>
              <div className="flex-1 grid md:grid-cols-2 gap-4">
                 <div>
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1 block group-hover:text-teal-400/50 transition-colors">Frente</span>
                    <div className="text-slate-200 text-sm prose prose-invert prose-sm max-w-none line-clamp-2" dangerouslySetInnerHTML={{ __html: card.front }}></div>
                 </div>
                 <div className="border-t md:border-t-0 md:border-l border-slate-800 pt-2 md:pt-0 md:pl-4">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1 block group-hover:text-teal-400/50 transition-colors">Verso</span>
                    <CardBackDisplay 
                      content={card.back} 
                      className="text-slate-300 text-sm prose-sm line-clamp-2" 
                      hideExtra={true} 
                    />
                 </div>
              </div>
              <div className="flex flex-col md:flex-row gap-2 items-center justify-center pl-2 md:pl-4 border-l border-slate-800 shrink-0">
                  <button 
                    onClick={(e) => handleValidateCard(e, card)} 
                    className={clsx(
                      "p-2 rounded-lg transition-colors",
                      card.is_validated 
                        ? "text-green-400 bg-green-900/20 hover:bg-green-900/40" 
                        : "text-slate-500 bg-slate-800 hover:bg-slate-700 hover:text-white"
                    )} 
                    title={card.is_validated ? "Card Validado" : "Validar Card"}
                  >
                      <CheckCircle size={16} />
                  </button>
                  <button onClick={() => handleOpenView(card)} className="p-2 text-slate-400 hover:bg-slate-700 hover:text-white rounded-lg transition-colors" title="Visualizar">
                      <Eye size={16} />
                  </button>
                  <Link to={`/deck/${deck.id}/edit/${card.id}`} className="p-2 text-slate-400 hover:bg-slate-700 hover:text-white rounded-lg transition-colors" title="Editar">
                      <Edit2 size={16} />
                  </Link>
                  <button 
                    type="button"
                    onClick={(e) => handleDeleteClick(e, card.id)} 
                    className="p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors relative z-10" 
                    title="Deletar"
                  >
                      <Trash2 size={16} />
                  </button>
              </div>
            </div>
          );
          });
        })()}
      </div>
    </div>
  );
}
