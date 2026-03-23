import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Home, Library, PlusCircle, User, Activity, GraduationCap, ChevronDown, ChevronRight, Heart, Scissors, Baby, Thermometer, ShieldCheck, ChevronLeft, Menu, X, LogOut, FolderHeart, Settings, Stethoscope, Wrench } from 'lucide-react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { supabase } from '../lib/supabase';
import { Deck } from '../types';

interface NavItemProps {
  to: string;
  icon: any;
  label: string;
  active: boolean;
  mobileOnly?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, label, active, mobileOnly = false, collapsed = false, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className={clsx(
      "flex items-center rounded-lg transition-all duration-200 group relative",
      mobileOnly ? "flex-col justify-center p-2" : (collapsed ? "justify-center p-3" : "gap-3 p-3"),
      active ? "text-brand-400 bg-brand-900/20" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
    )}
    title={collapsed ? label : undefined}
  >
    <Icon size={mobileOnly ? 24 : 20} strokeWidth={active ? 2.5 : 2} />
    {!collapsed && <span className={clsx("font-medium", mobileOnly ? "text-[10px] mt-1" : "text-sm")}>{label}</span>}
    
    {/* Tooltip for collapsed mode (Desktop only) */}
    {collapsed && !mobileOnly && (
      <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-slate-200 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-slate-700 transition-opacity">
        {label}
      </div>
    )}
  </Link>
);

// Level 2 Item (Expandable Area)
interface ExpandableMenuProps {
  label: string;
  count?: number;
  icon: any;
  children?: React.ReactNode;
  initialOpen?: boolean;
  collapsed?: boolean;
}

const ExpandableMenu: React.FC<ExpandableMenuProps> = ({ label, count, icon: Icon, children, initialOpen = false, collapsed = false }) => {
  const [isOpen, setIsOpen] = useState(initialOpen);

  if (collapsed) {
      return (
        <div className="relative group flex justify-center p-3">
             <button onClick={() => setIsOpen(!isOpen)} className="text-slate-400 hover:text-white relative">
                 <Icon size={20} />
                 {count !== undefined && count > 0 && (
                     <span className="absolute -top-1 -right-1 w-3 h-3 bg-brand-500 rounded-full text-[8px] flex items-center justify-center text-slate-950 font-bold">
                         {count}
                     </span>
                 )}
             </button>
             <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-slate-200 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-slate-700">
                {label} {count !== undefined && `(${count})`}
             </div>
        </div>
      );
  }

  return (
    <div>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-w-max flex items-center justify-between px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/30 rounded-md transition-colors group"
      >
        <div className="flex items-center gap-3">
          <Icon size={18} className="opacity-70 group-hover:opacity-100 text-brand-400 shrink-0" />
          <span className="font-medium flex-1 text-left whitespace-nowrap">{label}</span>
          {count !== undefined && <span className="text-xs text-slate-600 font-mono group-hover:text-slate-500">{count}</span>}
        </div>
        {isOpen ? <ChevronDown size={14} className="opacity-50 shrink-0 ml-2" /> : <ChevronRight size={14} className="opacity-50 shrink-0 ml-2" />}
      </button>
      {isOpen && (
        <div className="mt-1 space-y-0.5 animate-in slide-in-from-left-2 duration-200 pl-2">
          {children}
        </div>
      )}
    </div>
  );
};

// Level 3 Item (Sub-Group: e.g. Cardiologia inside Clinica)
interface SubGroupProps {
  label: string;
  count?: number;
  icon?: any;
  children?: React.ReactNode;
}

const SubGroup: React.FC<SubGroupProps> = ({ label, count, children, icon: Icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Auto-open if specific condition meets (optional, keeping manual for now to avoid clutter)

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-w-max flex items-center justify-between px-3 py-1.5 pl-9 text-xs text-slate-400 hover:text-brand-300 hover:bg-slate-800/30 rounded-md transition-colors group"
      >
        <div className="flex items-center gap-2">
           {Icon ? <Icon size={12} /> : <div className={clsx("w-1.5 h-1.5 rounded-full transition-colors", isOpen ? "bg-brand-500" : "bg-slate-600 group-hover:bg-brand-400")}></div>}
           <span className="font-medium opacity-90 text-left whitespace-nowrap">{label}</span>
        </div>
        <div className="flex items-center gap-2">
            {count !== undefined && <span className="text-[9px] text-slate-600 group-hover:text-slate-500">{count}</span>}
            {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </div>
      </button>
      {isOpen && (
        <div className="mt-0.5 ml-[2.5rem] border-l border-slate-800 pl-2 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
};

// Level 4 Item (Leaf Deck Link)
interface DeckLinkProps {
  label: string;
  to: string;
  onClick?: () => void;
}

const DeckLink: React.FC<DeckLinkProps> = ({ label, to, onClick }) => (
  <Link 
    to={to} 
    onClick={onClick}
    className="block min-w-max px-2 py-1 text-[11px] text-slate-500 hover:text-white hover:bg-slate-800/30 rounded-md transition-colors border-l border-transparent hover:border-slate-700 whitespace-nowrap"
    title={label}
  >
    {label}
  </Link>
);

// --- DYNAMIC MENU ORGANIZER ---

interface TreeNode {
    name: string;
    children: Record<string, TreeNode>;
    decks: Deck[];
}

const SidebarDecksMenu = ({ decks = [], onNavigate, collapsed = false }: { decks: Deck[], onNavigate?: () => void, collapsed?: boolean }) => {
    
    const RESIDENCY_AREAS = useMemo(() => [
        { 
            id: 'clinica', 
            label: 'Clínica Médica', 
            icon: Heart, 
            keywords: ['clinica', 'clínica'] 
        },
        { id: 'cirurgia', label: 'Cirurgia', icon: Scissors, keywords: ['cirurgia', 'cirurgia geral', 'ortopedia', 'cirur'] },
        { id: 'pediatria', label: 'Pediatria', icon: Stethoscope, keywords: ['pediatria', 'neo', 'puericultura', 'ped'] },
        { id: 'go', label: 'Ginecologia', icon: Thermometer, keywords: ['ginecologia', 'gineco', 'mastologia'] },
        { id: 'obs', label: 'Obstetrícia', icon: Baby, keywords: ['obstetrícia', 'obstetricia', 'obs', 'parto'] },
        { id: 'preventiva', label: 'Preventiva', icon: ShieldCheck, keywords: ['preventiva', 'sus', 'epidemiologia', 'coletiva'] }
    ], []);

    // Build the Tree Structure
    const { organizedResidency, unassigned, areaCounts } = useMemo(() => {
        const root: Record<string, TreeNode> = {}; // Key is Area Label
        const una: Deck[] = [];
        const counts: Record<string, number> = {};

        // Initialize Roots based on Areas
        RESIDENCY_AREAS.forEach(a => {
            root[a.label] = { name: a.label, children: {}, decks: [] };
            counts[a.label] = 0;
        });

        decks.forEach(deck => {
            // 1. Cleaning
            const rawTitle = deck.title.trim();

            let cleanLabel = rawTitle.includes(':') 
                ? rawTitle.split(':').slice(1).join(':').trim() 
                : rawTitle;

            // 2. Determine Area and Path
            let assignedArea = null;
            let pathTags: string[] = [];

            // Normalize tags
            const tags = deck.tags || [];
            
            // Find the Area (Level 1)
            for (const area of RESIDENCY_AREAS) {
                if (tags.some(t => area.keywords.some(k => t.toLowerCase().includes(k)))) {
                    assignedArea = area.label;
                    break;
                }
            }

            if (assignedArea) {
                counts[assignedArea]++;
                
                // Filter tags to build the path inside the area
                // Remove "Residência Médica" and the Area Name itself
                pathTags = tags.filter(t => {
                    const lt = t.toLowerCase();
                    
                    // 1. Global exclusions
                    if (lt.includes('residência') || lt.includes('medicina')) return false;

                    // 2. Area-specific exclusions
                    // Only remove if it's redundant to the Area itself
                    const areaConfig = RESIDENCY_AREAS.find(a => a.label === assignedArea);
                    if (areaConfig) {
                        // Normalize strings for comparison (remove accents, lowercase)
                        const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        const normTag = normalize(lt);
                        const normLabel = normalize(areaConfig.label);

                        // Remove if it matches the Area Label exactly (e.g. "Clinica Medica" inside Clinica Medica)
                        if (normTag === normLabel) return false;
                        
                        // Remove if it matches a keyword exactly (e.g. "Ped" inside Pediatria)
                        // But DO NOT remove if it just contains a short keyword (e.g. "Neonatologia" contains "neo")
                        if (areaConfig.keywords.some(k => lt === k)) return false;
                    }

                    return true;
                });

                // Traverse/Build Tree
                let currentNode = root[assignedArea];
                
                // Create nodes for each remaining tag
                for (const tag of pathTags) {
                    // Capitalize nicely
                    const tagName = tag.charAt(0).toUpperCase() + tag.slice(1);
                    
                    if (!currentNode.children[tagName]) {
                        currentNode.children[tagName] = { name: tagName, children: {}, decks: [] };
                    }
                    currentNode = currentNode.children[tagName];
                }

                // Add deck to the leaf node
                currentNode.decks.push({ ...deck, title: cleanLabel }); // Use clean label

            } else {
                una.push({ ...deck, title: cleanLabel });
            }
        });

        return { organizedResidency: root, unassigned: una, areaCounts: counts };
    }, [decks, RESIDENCY_AREAS]);

    // Recursive Renderer
    const renderTree = (node: TreeNode) => {
        const childKeys = Object.keys(node.children).sort();
        const nodeDecks = node.decks.sort((a, b) => a.title.localeCompare(b.title));

        return (
            <>
                {childKeys.map(key => (
                    <SubGroup key={key} label={node.children[key].name} count={undefined}>
                        {renderTree(node.children[key])}
                    </SubGroup>
                ))}
                {nodeDecks.map(deck => (
                    <DeckLink key={deck.id} label={deck.title} to={`/deck/${deck.id}`} onClick={onNavigate} />
                ))}
            </>
        );
    };

    return (
        <div className="space-y-1">
            {/* 1. Residência Médica (Wrapper) */}
            <ExpandableMenu label="Residência Médica" icon={GraduationCap} initialOpen={true} collapsed={collapsed}>
                {RESIDENCY_AREAS.map(area => {
                    if (areaCounts[area.label] === 0) return null;
                    return (
                        <ExpandableMenu 
                            key={area.id} 
                            label={area.label} 
                            count={areaCounts[area.label]} 
                            icon={area.icon} 
                            collapsed={collapsed}
                        >
                            {renderTree(organizedResidency[area.label])}
                        </ExpandableMenu>
                    );
                })}
            </ExpandableMenu>

            {/* 2. Meus Decks */}
            {unassigned.length > 0 && (
                <ExpandableMenu 
                    label="Meus Decks" 
                    count={unassigned.length} 
                    icon={FolderHeart} 
                    initialOpen={true} 
                    collapsed={collapsed}
                >
                     {unassigned.map(deck => (
                         <DeckLink key={deck.id} label={deck.title} to={`/deck/${deck.id}`} onClick={onNavigate} />
                     ))}
                </ExpandableMenu>
            )}
        </div>
    );
};

export function Layout() {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [decks, setDecks] = useState<Deck[]>([]);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    async function fetchDecks() {
      const { data, error } = await supabase
        .from('decks_template')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        setDecks(data as Deck[]);
      }
    }
    fetchDecks();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen md:h-[100dvh] bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 z-40 flex items-center justify-between px-4">
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 -ml-2 text-slate-400 hover:text-white rounded-lg active:bg-slate-800 transition-colors"
        >
          <Menu size={24} />
        </button>
        <div className="flex items-center gap-2">
            {/* Logo removed from mobile header to only show in sidebar */}
        </div>
        <div className="w-8"></div>
      </div>

      {/* MOBILE SIDEBAR */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[80%] max-w-sm bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
             <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <Link to="/" className="flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)}>
                  <div className="w-8 h-8 rounded-lg bg-[#14b8a6] flex items-center justify-center text-slate-950 font-bold text-lg">M</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-bold text-[#14b8a6]">MedFlash ADM</span>
                    <Wrench size={18} className="text-[#14b8a6]" />
                  </div>
                </Link>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 -mr-2 text-slate-400 hover:text-white rounded-lg active:bg-slate-800">
                  <X size={24} />
                </button>
             </div>
             <div className="flex-1 flex flex-col min-h-0 p-4">
                <nav className="space-y-1 shrink-0 mb-6">
                  <NavItem to="/" icon={Home} label="Início" active={location.pathname === '/'} onClick={() => setIsMobileMenuOpen(false)} />
                  <NavItem to="/library" icon={Library} label="Biblioteca" active={location.pathname === '/library' && !location.search} onClick={() => setIsMobileMenuOpen(false)} />
                  <NavItem to="/create" icon={PlusCircle} label="Criar Deck" active={location.pathname === '/create'} onClick={() => setIsMobileMenuOpen(false)} />
                </nav>
                <div className="flex-1 flex flex-col min-h-0">
                   <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3 shrink-0">
                      Categorias
                   </div>
                   <div className="space-y-1 overflow-auto custom-scrollbar pb-2 flex-1 min-h-0 -mr-2 pr-2">
                      <div className="min-w-full w-max">
                          <SidebarDecksMenu decks={decks} onNavigate={() => setIsMobileMenuOpen(false)} />
                      </div>
                   </div>
                </div>
             </div>
             <div className="p-4 border-t border-slate-800 space-y-1">
               <NavItem to="/profile" icon={User} label="Meu Perfil" active={location.pathname === '/profile'} onClick={() => setIsMobileMenuOpen(false)} />
               <NavItem to="/settings" icon={Settings} label="Configurações" active={location.pathname === '/settings'} onClick={() => setIsMobileMenuOpen(false)} />
               <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                 <LogOut size={24} />
                 <span className="text-sm font-medium">Sair</span>
               </button>
             </div>
          </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className={clsx("hidden md:flex flex-col border-r border-slate-800 bg-slate-900/50 pt-4 pb-3 relative transition-all duration-300 ease-in-out", isCollapsed ? "w-20 px-2" : "w-64 px-4")}>
        <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3 top-7 z-20 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white p-1 rounded-full shadow-lg transition-transform hover:scale-110 flex items-center justify-center"
            title={isCollapsed ? "Expandir" : "Recolher"}
        >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <Link to="/" className={clsx("flex items-center gap-2 mb-4 transition-all duration-300", isCollapsed ? "justify-center px-0" : "px-2")}>
          <div className="w-8 h-8 rounded-lg bg-[#14b8a6] flex items-center justify-center text-slate-950 font-bold text-lg shrink-0 shadow-lg shadow-[#14b8a6]/20">M</div>
          {!isCollapsed && (
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="text-xl font-bold text-[#14b8a6] whitespace-nowrap animate-in fade-in duration-300">MedFlash ADM</span>
              <Wrench size={18} className="text-[#14b8a6] shrink-0 animate-in fade-in duration-300" />
            </div>
          )}
        </Link>

        <nav className="space-y-1 mb-2">
          <NavItem to="/" icon={Home} label="Início" active={location.pathname === '/'} collapsed={isCollapsed} />
          <NavItem to="/library" icon={Library} label="Biblioteca" active={location.pathname === '/library' && !location.search} collapsed={isCollapsed} />
          <NavItem to="/create" icon={PlusCircle} label="Criar Deck" active={location.pathname === '/create'} collapsed={isCollapsed} />
        </nav>

        <div className={clsx("mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider transition-opacity duration-300", isCollapsed ? "text-center opacity-0 h-0 overflow-hidden" : "px-3 opacity-100")}>
          Categorias
        </div>
        
        {isCollapsed && <div className="h-[1px] bg-slate-800 w-10 mx-auto mb-2"></div>}

        {/* AJUSTE TABLET: min-h-0 garante que o scroll funcione dentro do flex container sem estourar o layout vertical */}
        <div className="space-y-1 mb-2 overflow-auto custom-scrollbar flex-1 -mr-2 pr-2 min-h-0">
            <div className="min-w-full w-max">
                <SidebarDecksMenu decks={decks} collapsed={isCollapsed} />
            </div>
        </div>

        <div className="mt-auto pt-3 border-t border-slate-800 space-y-1 shrink-0">
          <NavItem to="/profile" icon={User} label="Meu Perfil" active={location.pathname === '/profile'} collapsed={isCollapsed} />
          <NavItem to="/settings" icon={Settings} label="Configurações" active={location.pathname === '/settings'} collapsed={isCollapsed} />
          <button onClick={handleLogout} className={clsx("w-full flex items-center rounded-lg transition-all duration-200 group relative text-red-400 hover:text-red-300 hover:bg-red-500/10", isCollapsed ? "justify-center p-3" : "gap-3 p-3")}>
             <LogOut size={20} />
             {!isCollapsed && <span className="text-sm font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      <main ref={mainRef} className="flex-1 overflow-y-auto no-scrollbar relative z-0 flex flex-col pt-16 md:pt-0">
        <div className="flex-1 w-full max-w-4xl mx-auto p-4 pb-24 md:pb-8">
          <Outlet />
        </div>
      </main>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 z-50">
        <div className="flex justify-around items-center p-2">
          <NavItem to="/" icon={Home} label="Início" active={location.pathname === '/'} mobileOnly />
          <NavItem to="/library" icon={Library} label="Biblioteca" active={location.pathname === '/library'} mobileOnly />
          <NavItem to="/create" icon={PlusCircle} label="Criar" active={location.pathname === '/create'} mobileOnly />
        </div>
      </div>
    </div>
  );
}
