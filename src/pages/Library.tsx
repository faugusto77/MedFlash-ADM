import React, { useState, useEffect } from 'react';
import { Search, Plus, FolderOpen, Tag, Layers, Trophy, ChevronRight, Folder, Home } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getDeckCoverImage, FALLBACK_IMAGE } from '../utils/imageMapping';
import { clsx } from 'clsx';

export function Library() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [decks, setDecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchState, setSearchState] = useState('');
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  
  // Use search from URL if available, otherwise use local state
  const search = searchParams.get('search') || searchState;

  useEffect(() => {
    async function fetchDecks() {
      try {
        setLoading(true);
        const { data: decksData, error: decksError } = await supabase
          .from('decks_template')
          .select('*');

        if (decksError) {
          console.error('Error fetching from Supabase:', decksError.message);
        } else if (decksData) {
          // Fetch all flashcards to calculate stats using pagination to avoid 1000 row limit
          let allCards: any[] = [];
          let hasMore = true;
          let from = 0;
          const step = 1000;

          while (hasMore) {
            const { data: cardsBatch, error: cardsError } = await supabase
              .from('flashcards_template')
              .select('id, is_validated, deck_id')
              .range(from, from + step - 1);
              
            if (cardsError) {
              console.error('Error fetching cards:', cardsError.message);
              break;
            }
            
            if (cardsBatch && cardsBatch.length > 0) {
              allCards = [...allCards, ...cardsBatch];
              from += step;
              if (cardsBatch.length < step) {
                hasMore = false;
              }
            } else {
              hasMore = false;
            }
          }

          const mapped = decksData.map(d => {
            const deckCards = allCards.filter(c => c.deck_id === d.id);
            const deckTotal = deckCards.length;
            const deckValidated = deckCards.filter(c => c.is_validated).length;
            const deckPercentage = deckTotal > 0 ? Math.round((deckValidated / deckTotal) * 100) : 0;

            return {
              ...d,
              id: d.id,
              title: d.title || 'Sem Título',
              tags: Array.isArray(d.tags) ? d.tags : [],
              icon: d.icon || '📚',
              cards: new Array(deckTotal),
              stats: { masteryPercentage: deckPercentage }
            };
          });
          setDecks(mapped);
        }
      } catch (err) {
        console.error('Exception fetching from Supabase:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDecks();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchState(e.target.value);
    if (e.target.value) {
      setCurrentPath([]);
      setSearchParams({ search: e.target.value });
    } else {
      setSearchParams({});
    }
  };
  
  const seenTitles = new Set<string>();

  // Helper para determinar a cor baseada no Mastery
  const getMasteryColor = (mastery: number) => {
    if (mastery === 100) return { bar: "bg-gradient-to-r from-yellow-400 to-orange-500", text: "text-yellow-400" }; // Ouro (Mantido)
    if (mastery >= 67) return { bar: "bg-emerald-500", text: "text-emerald-400" }; // Verde
    if (mastery >= 34) return { bar: "bg-yellow-500", text: "text-yellow-400" }; // Amarelo
    return { bar: "bg-red-500", text: "text-red-400" }; // Vermelho
  };

  // --- LOGIC FOR FOLDER NAVIGATION ---
  
  // 1. Filter decks relevant to current view (Search OR Path)
  const relevantDecks = decks.filter(d => {
      if (search) {
          // Search Mode: Match query
          return d.title.toLowerCase().includes(search.toLowerCase()) || 
                 d.tags.some((t: string) => t.toLowerCase().includes(search.toLowerCase()));
      } else {
          // Folder Mode: Match current path prefix
          if (d.tags.length < currentPath.length) return false;
          for (let i = 0; i < currentPath.length; i++) {
              if (d.tags[i] !== currentPath[i]) return false;
          }
          return true;
      }
  });

  // 2. Extract Folders and Files for current level
  const currentFolders = new Set<string>();
  const currentFiles: any[] = [];

  if (!search) {
      relevantDecks.forEach(d => {
          if (d.tags.length > currentPath.length) {
              // Has more tags -> It's a folder at this level
              currentFolders.add(d.tags[currentPath.length]);
          } else {
              // No more tags -> It's a file at this level
              // Dedup logic for files
              const rawTitle = d.title.trim();
              let cleanLabel = rawTitle.includes(':') 
                  ? rawTitle.split(':').slice(1).join(':').trim() 
                  : rawTitle;
              if (cleanLabel === 'HAS (Completo)') cleanLabel = 'HAS';

              if (!seenTitles.has(cleanLabel)) {
                  seenTitles.add(cleanLabel);
                  currentFiles.push({ ...d, title: cleanLabel });
              }
          }
      });
  } else {
      // Search Mode: Flatten everything
      relevantDecks.forEach(d => {
          const rawTitle = d.title.trim();
          let cleanLabel = rawTitle.includes(':') 
              ? rawTitle.split(':').slice(1).join(':').trim() 
              : rawTitle;
          if (cleanLabel === 'HAS (Completo)') cleanLabel = 'HAS';

          if (!seenTitles.has(cleanLabel)) {
              seenTitles.add(cleanLabel);
              currentFiles.push({ ...d, title: cleanLabel });
          }
      });
  }

  const sortedFolders = Array.from(currentFolders).sort();
  const sortedFiles = currentFiles.sort((a, b) => a.title.localeCompare(b.title));

  const handleFolderClick = (folderName: string) => {
      setCurrentPath([...currentPath, folderName]);
  };

  const handleBreadcrumbClick = (index: number) => {
      setCurrentPath(currentPath.slice(0, index + 1));
  };

  const handleHomeClick = () => {
      setCurrentPath([]);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-right-4">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-white">Biblioteca ({decks.length})</h1>
           {search && <p className="text-xs text-teal-400 mt-1">Filtrando por: "{search}" ({sortedFiles.length})</p>}
        </div>
        <Link to="/create" className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
          <Plus size={20} className="text-teal-400" />
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md pb-2 pt-1">
        <div className="absolute inset-y-0 left-0 pl-3 top-1 flex items-center pointer-events-none">
          <Search size={18} className="text-slate-500" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-xl leading-5 bg-slate-900 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent sm:text-sm"
          placeholder="Buscar por título, categoria ou tag..."
          value={search}
          onChange={handleSearchChange}
        />
        {search && (
            <button 
                onClick={() => {
                  setSearchState('');
                  setSearchParams({});
                  setCurrentPath([]);
                }}
                className="absolute inset-y-0 right-10 top-1 flex items-center h-full text-slate-500 hover:text-white text-xs uppercase"
            >
                Limpar
            </button>
        )}
      </div>

      {/* Breadcrumbs (Only visible when not searching and path is not empty) */}
      {!search && currentPath.length > 0 && (
          <nav className="flex items-center text-sm text-slate-400 overflow-x-auto whitespace-nowrap pb-2 scrollbar-hide">
              <button 
                  onClick={handleHomeClick}
                  className="hover:text-white flex items-center transition-colors"
              >
                  <Home size={16} className="mr-1" />
                  Início
              </button>
              {currentPath.map((folder, index) => (
                  <React.Fragment key={index}>
                      <ChevronRight size={14} className="mx-2 text-slate-600" />
                      <button 
                          onClick={() => index === currentPath.length - 1 ? null : handleBreadcrumbClick(index)}
                          className={clsx(
                              "transition-colors",
                              index === currentPath.length - 1 
                                  ? "text-white font-semibold cursor-default" 
                                  : "hover:text-white"
                          )}
                      >
                          {folder}
                      </button>
                  </React.Fragment>
              ))}
          </nav>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
        
        {/* Folders */}
        {!search && sortedFolders.map(folder => (
            <div 
                key={folder}
                onClick={() => handleFolderClick(folder)}
                className="group cursor-pointer relative bg-slate-900/50 border border-slate-800 hover:border-teal-500/50 rounded-xl p-4 flex items-center gap-4 transition-all hover:bg-slate-800"
            >
                <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center text-teal-400 group-hover:scale-110 transition-transform">
                    <Folder size={24} fill="currentColor" className="opacity-80" />
                </div>
                <div className="flex-1">
                    <h3 className="font-medium text-slate-200 group-hover:text-white">{folder}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Pasta</p>
                </div>
                <ChevronRight size={16} className="text-slate-600 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
            </div>
        ))}

        {/* Decks (Files) */}
        {sortedFiles.map((deck) => {
            const mastery = deck.stats?.masteryPercentage || 0;
            const colors = getMasteryColor(mastery);
            
            return (
            <Link key={deck.id} to={`/deck/${deck.id}`} className="group relative">
               <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-600 to-emerald-600 rounded-xl blur opacity-0 group-hover:opacity-40 transition duration-300"></div>
               <div className="relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-full hover:bg-slate-800/80 transition-colors">
                
                {/* Image Placeholder using Context Aware Mapper */}
                <div className="h-28 w-full bg-slate-800 relative overflow-hidden">
                    <img 
                        loading="lazy" 
                        src={getDeckCoverImage(deck)} 
                        alt={deck.title} 
                        onError={(e) => {
                          // Fallback to robust placeholder if load fails
                          (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                        }}
                        className="w-full h-full object-cover opacity-60 group-hover:scale-110 group-hover:opacity-80 transition-all duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
                    <div className="absolute bottom-3 left-3 flex items-center space-x-2">
                        <span className="text-3xl filter drop-shadow-md">{deck.icon}</span>
                    </div>
                </div>

                <div className="p-4 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-base text-slate-100 leading-tight line-clamp-1 group-hover:text-teal-300 transition-colors">{deck.title}</h3>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mb-4 h-6 overflow-hidden">
                      {deck.tags.slice(0, 3).map((tag: string) => (
                          <div key={tag} className="flex items-center text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 rounded-full whitespace-nowrap">
                              <Tag size={10} className="mr-1 opacity-50" />
                              {tag}
                          </div>
                      ))}
                      {deck.tags.length > 3 && (
                        <span className="text-[10px] text-slate-500 px-1">+{deck.tags.length - 3}</span>
                      )}
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-800/50">
                    <div className="flex justify-between items-end mb-2">
                        <div className="flex items-center gap-1.5 text-slate-500">
                            <Layers size={14} className="opacity-70" />
                            <span className="text-xs font-medium">{deck.cards.length} cards</span>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                            <Trophy size={14} className={clsx("opacity-80", colors.text)} />
                            <span className={clsx("text-xs font-bold", colors.text)}>
                                {mastery}%
                            </span>
                        </div>
                    </div>
                    
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            className={clsx(
                                "h-full rounded-full transition-all duration-500 relative",
                                colors.bar
                            )}
                            style={{ width: `${mastery}%` }}
                        >
                             {/* Shine Effect */}
                             <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
                        </div>
                    </div>
                  </div>

                </div>
              </div>
            </Link>
          )})
        }

        {/* Empty State */}
        {sortedFolders.length === 0 && sortedFiles.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500">
            <FolderOpen size={48} className="mb-4 opacity-50" />
            <p>{search ? `Nenhum deck encontrado para "${search}".` : "Esta pasta está vazia."}</p>
            {search && (
                <button onClick={() => {
                  setSearchState('');
                  setSearchParams({});
                  setCurrentPath([]);
                }} className="mt-2 text-teal-400 text-sm hover:underline">
                    Limpar busca
                </button>
            )}
            {!search && currentPath.length > 0 && (
                <button onClick={handleHomeClick} className="mt-2 text-teal-400 text-sm hover:underline">
                    Voltar ao início
                </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
