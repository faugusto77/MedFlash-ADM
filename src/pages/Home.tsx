import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Layers, CheckCircle, Clock, ChevronRight, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDeckCoverImage, FALLBACK_IMAGE } from '../utils/imageMapping';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export function Home() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDecks: 0,
    validatedDecks: 0,
    decksPercentage: 0,
    totalCards: 0,
    validatedCards: 0,
    cardsPercentage: 0
  });
  const [allDecks, setAllDecks] = useState<any[]>([]);
  const [deckFilter, setDeckFilter] = useState<'all' | 'with_cards' | 'empty'>('all');

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        
        // Fetch all decks
        const { data: decks, error: decksError } = await supabase
          .from('decks_template')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (decksError) throw decksError;
        
        // Fetch all flashcards to calculate stats using pagination to avoid 1000 row limit
        let allCards: any[] = [];
        let hasMore = true;
        let from = 0;
        const step = 1000;

        while (hasMore) {
          const { data, error } = await supabase
            .from('flashcards_template')
            .select('id, is_validated, deck_id')
            .range(from, from + step - 1);
            
          if (error) throw error;
          
          if (data && data.length > 0) {
            allCards = [...allCards, ...data];
            from += step;
            if (data.length < step) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }
        
        const cards = allCards;
        
        const totalCards = cards?.length || 0;
        const validatedCards = cards?.filter(c => c.is_validated).length || 0;
        const cardsPercentage = totalCards > 0 ? Math.round((validatedCards / totalCards) * 100) : 0;

        const totalDecks = decks?.length || 0;
        let validatedDecksCount = 0;
        const recentValidatedDecks: any[] = [];
        
        const mappedDecks = decks?.map(d => {
          const deckCards = cards?.filter(c => c.deck_id === d.id) || [];
          const deckTotal = deckCards.length;
          const deckValidated = deckCards.filter(c => c.is_validated).length;
          const isDeckValidated = deckTotal > 0 && deckTotal === deckValidated;
          
          if (isDeckValidated) {
            validatedDecksCount++;
          }
          
          const deckPercentage = deckTotal > 0 ? Math.round((deckValidated / deckTotal) * 100) : 0;
          
          const mappedDeck = {
            ...d,
            title: d.title || 'Sem Título',
            tags: Array.isArray(d.tags) ? d.tags : [],
            validatedCount: deckValidated,
            totalCount: deckTotal,
            percentage: deckPercentage,
            isDeckValidated
          };
          
          if (deckValidated > 0) {
            recentValidatedDecks.push(mappedDeck);
          }
          
          return mappedDeck;
        }) || [];
        
        const decksPercentage = totalDecks > 0 ? Math.round((validatedDecksCount / totalDecks) * 100) : 0;
        
        setStats({ 
          totalDecks, 
          validatedDecks: validatedDecksCount, 
          decksPercentage,
          totalCards,
          validatedCards,
          cardsPercentage
        });
        
        setAllDecks(mappedDecks);
        
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchDashboardData();
  }, []);

  const filteredDecks = useMemo(() => {
    let filtered = [...allDecks];
    
    if (deckFilter === 'with_cards') {
      filtered = filtered.filter(d => d.totalCount > 0);
    } else if (deckFilter === 'empty') {
      filtered = filtered.filter(d => d.totalCount === 0);
    }
    
    // Ordenar por decks com mais cards validados quando "Todos" ou "Com Cards"
    if (deckFilter === 'all' || deckFilter === 'with_cards') {
      filtered.sort((a, b) => {
        // 1. Maior número de cards validados primeiro
        if (b.validatedCount !== a.validatedCount) {
          return b.validatedCount - a.validatedCount;
        }
        // 2. Maior número total de cards como desempate
        if (b.totalCount !== a.totalCount) {
          return b.totalCount - a.totalCount;
        }
        // 3. Mais recentes primeiro como último desempate
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    
    return filtered;
  }, [allDecks, deckFilter]);

  const decksChartData = [
    { name: 'Validados', value: stats.validatedDecks, color: '#4ade80' },
    { name: 'Não Validados', value: stats.totalDecks - stats.validatedDecks, color: '#1e293b' }
  ].filter(d => d.value > 0);
  
  if (stats.totalDecks === 0) {
    decksChartData.push({ name: 'Vazio', value: 1, color: '#1e293b' });
  }

  const cardsChartData = [
    { name: 'Validados', value: stats.validatedCards, color: '#3b82f6' },
    { name: 'Não Validados', value: stats.totalCards - stats.validatedCards, color: '#1e293b' }
  ].filter(d => d.value > 0);
  
  if (stats.totalCards === 0) {
    cardsChartData.push({ name: 'Vazio', value: 1, color: '#1e293b' });
  }

  if (loading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar bg-slate-950">
      <div className="max-w-6xl mx-auto space-y-8 pb-20">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Visão Geral</h1>
            <p className="text-slate-400">Acompanhe o progresso de validação dos seus flashcards.</p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Decks Stat Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 flex items-center justify-between gap-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
              <Layers size={120} className="text-green-500" />
            </div>
            
            <div className="relative z-10 flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 shrink-0">
                  <Layers size={20} />
                </div>
                <h3 className="text-slate-300 font-medium leading-tight truncate">Decks Validados</h3>
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-4xl md:text-5xl font-light text-white tracking-tight">{stats.validatedDecks}</span>
                <span className="text-slate-500 font-medium">/ {stats.totalDecks}</span>
              </div>
            </div>

            <div className="relative w-20 h-20 md:w-24 md:h-24 shrink-0 z-10">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={decksChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius="70%"
                    outerRadius="90%"
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {decksChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg md:text-xl font-medium text-white leading-none">
                  {stats.decksPercentage}%
                </span>
              </div>
            </div>
          </div>

          {/* Cards Stat Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 flex items-center justify-between gap-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
              <CheckCircle size={120} className="text-blue-500" />
            </div>
            
            <div className="relative z-10 flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                  <CheckCircle size={20} />
                </div>
                <h3 className="text-slate-300 font-medium leading-tight truncate">Cards Validados</h3>
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-4xl md:text-5xl font-light text-white tracking-tight">{stats.validatedCards}</span>
                <span className="text-slate-500 font-medium">/ {stats.totalCards}</span>
              </div>
            </div>

            <div className="relative w-20 h-20 md:w-24 md:h-24 shrink-0 z-10">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cardsChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius="70%"
                    outerRadius="90%"
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {cardsChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg md:text-xl font-medium text-white leading-none">
                  {stats.cardsPercentage}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Decks List */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Layers size={20} className="text-slate-400" />
                Decks
              </h2>
            </div>
            
            <div className="flex items-center justify-between w-full sm:w-auto gap-4">
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setDeckFilter('all')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${deckFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setDeckFilter('with_cards')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${deckFilter === 'with_cards' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  Com Cards
                </button>
                <button
                  onClick={() => setDeckFilter('empty')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${deckFilter === 'empty' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  Vazios
                </button>
              </div>
            </div>
          </div>
          
          {filteredDecks.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
              <Layers size={48} className="text-slate-700 mb-4" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">Nenhum deck encontrado</h3>
              <p className="text-slate-500 max-w-md">
                {deckFilter === 'empty' 
                  ? 'Você não possui decks vazios no momento.' 
                  : deckFilter === 'with_cards' 
                    ? 'Você não possui decks com cards no momento.' 
                    : 'Você ainda não possui nenhum deck. Crie um novo deck para começar.'}
              </p>
              <Link to="/library" className="mt-6 bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                Ir para Biblioteca
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredDecks.map(deck => (
                <Link 
                  key={deck.id} 
                  to={`/deck/${deck.id}`}
                  className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-4 hover:bg-slate-800/50 hover:border-slate-700 transition-all group"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-2xl shrink-0">
                      {deck.icon || '📚'}
                    </div>
                    <div className="flex flex-col flex-1">
                      <h3 className="font-bold text-white text-base group-hover:text-brand-300 transition-colors">
                        {deck.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-slate-400">
                          {deck.totalCount} cards
                        </span>
                        <div className="flex items-center gap-2 w-24 sm:w-32">
                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 rounded-full transition-all duration-500" 
                              style={{ width: `${deck.percentage}%` }} 
                            />
                          </div>
                          <span className="text-xs text-slate-400 font-medium">
                            {deck.percentage}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={20} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
