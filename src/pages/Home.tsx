import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Layers, CheckCircle, Clock, ChevronRight } from 'lucide-react';
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
  const [recentDecks, setRecentDecks] = useState<any[]>([]);

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
        
        // Fetch all flashcards to calculate stats
        const { data: cards, error: cardsError } = await supabase
          .from('flashcards_template')
          .select('id, is_validated, deck_id');
          
        if (cardsError) throw cardsError;
        
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
        
        // Show up to 6 most recently created decks that have validated cards
        setRecentDecks(recentValidatedDecks.slice(0, 6));
        
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchDashboardData();
  }, []);

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

        {/* Recent Validated Decks */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock size={20} className="text-slate-400" />
              Decks Recentes
            </h2>
            <Link to="/library" className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
              Ver todos <ChevronRight size={16} />
            </Link>
          </div>
          
          {recentDecks.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
              <Layers size={48} className="text-slate-700 mb-4" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">Nenhum deck com cards validados</h3>
              <p className="text-slate-500 max-w-md">
                Você ainda não validou nenhum card. Acesse seus decks e comece a validar o conteúdo.
              </p>
              <Link to="/library" className="mt-6 bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                Ir para Biblioteca
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentDecks.map(deck => (
                <Link 
                  key={deck.id} 
                  to={`/deck/${deck.id}`}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all group flex flex-col"
                >
                  <div className="h-32 w-full relative overflow-hidden bg-slate-800">
                    <img 
                      src={getDeckCoverImage(deck.tags, deck.title)} 
                      alt={deck.title}
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{deck.icon || '📚'}</span>
                        <h3 className="font-bold text-white text-lg leading-tight line-clamp-1 group-hover:text-brand-300 transition-colors">
                          {deck.title}
                        </h3>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                        <Layers size={14} />
                        <span>{deck.totalCount} cards</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-green-400 text-sm font-medium bg-green-400/10 px-2 py-0.5 rounded-md">
                        <CheckCircle size={14} />
                        <span>{deck.validatedCount} validados</span>
                      </div>
                    </div>
                    
                    <div className="w-full bg-slate-800 rounded-full h-1.5 mb-1 overflow-hidden">
                      <div 
                        className="bg-green-500 h-1.5 rounded-full transition-all duration-500" 
                        style={{ width: `${deck.percentage}%` }}
                      ></div>
                    </div>
                    <div className="text-right text-[10px] text-slate-500 font-medium">
                      {deck.percentage}% concluído
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
