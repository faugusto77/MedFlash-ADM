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
    percentage: 0
  });
  const [recentDecks, setRecentDecks] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        
        // Fetch all decks
        const { data: decks, error: decksError } = await supabase
          .from('decks_template')
          .select('id, title, tags, created_at, cover_image')
          .order('created_at', { ascending: false });
          
        if (decksError) throw decksError;
        
        // Fetch all flashcards to calculate stats
        const { data: cards, error: cardsError } = await supabase
          .from('flashcards_template')
          .select('id, is_validated, deck_id');
          
        if (cardsError) throw cardsError;
        
        const totalDecks = decks?.length || 0;
        let validatedDecksCount = 0;
        const fullyValidatedDecks: any[] = [];
        
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
          
          if (isDeckValidated) {
            fullyValidatedDecks.push(mappedDeck);
          }
          
          return mappedDeck;
        }) || [];
        
        const percentage = totalDecks > 0 ? Math.round((validatedDecksCount / totalDecks) * 100) : 0;
        
        setStats({ totalDecks, validatedDecks: validatedDecksCount, percentage });
        
        // Show up to 6 most recently created decks that are fully validated
        setRecentDecks(fullyValidatedDecks.slice(0, 6));
        
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchDashboardData();
  }, []);

  const chartData = [
    { name: 'Validados', value: stats.validatedDecks, color: '#4ade80' },
    { name: 'Não Validados', value: stats.totalDecks - stats.validatedDecks, color: '#1e293b' }
  ].filter(d => d.value > 0);
  
  if (stats.totalDecks === 0) {
    chartData.push({ name: 'Vazio', value: 1, color: '#1e293b' });
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Stat Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <CheckCircle size={100} className="text-green-500" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
                  <Layers size={20} />
                </div>
                <h3 className="text-slate-300 font-medium">Decks Validados</h3>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-light text-white tracking-tight">{stats.validatedDecks}</span>
                <span className="text-slate-500 font-medium">/ {stats.totalDecks}</span>
              </div>
            </div>
          </div>

          {/* Chart Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center gap-6">
            <div className="relative w-24 h-24 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={45}
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
                <span className="text-xl font-medium text-white leading-none">
                  {stats.percentage}%
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                <span className="text-sm text-slate-300">Validados ({stats.validatedDecks})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-800"></div>
                <span className="text-sm text-slate-300">Pendentes ({stats.totalDecks - stats.validatedDecks})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Validated Decks */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock size={20} className="text-slate-400" />
              Decks Validados
            </h2>
            <Link to="/library" className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
              Ver todos <ChevronRight size={16} />
            </Link>
          </div>
          
          {recentDecks.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
              <Layers size={48} className="text-slate-700 mb-4" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">Nenhum deck validado</h3>
              <p className="text-slate-500 max-w-md">
                Você ainda não validou todos os cards de nenhum deck. Acesse seus decks e comece a validar o conteúdo.
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
