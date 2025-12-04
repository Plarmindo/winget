import React, { useState } from 'react';
import { Palette, Plus, Edit2, Copy, Trash2, Save, Grid, Minus, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppSettings, AppTheme } from '../../types';
import { DEFAULT_THEMES } from '../../constants';

interface AppearanceTabProps {
   settings: AppSettings;
   onUpdateSettings: (s: AppSettings) => void;
}

interface ThemePreviewProps {
   theme: AppTheme;
   isActive: boolean;
   onClick: () => void;
   onEdit: (e: any) => void;
   onDelete?: (e: any) => void;
}

const ThemePreview: React.FC<ThemePreviewProps> = ({ theme, isActive, onClick, onEdit, onDelete }) => {
   if (!theme || !theme.colors) return null;
   return (
      <div
         onClick={onClick}
         className={`group relative rounded-xl border-2 transition-all duration-200 cursor-pointer overflow-hidden ${isActive
            ? 'border-[var(--app-primary)] ring-2 ring-[var(--app-primary)]/20 scale-[1.02]'
            : 'border-[var(--app-border)] hover:border-[var(--app-text-muted)] hover:scale-[1.01]'
            }`}
      >
         <div className="h-16 w-full flex">
            <div className="flex-1" style={{ backgroundColor: theme.colors.bg || '#000' }}></div>
            <div className="flex-1" style={{ backgroundColor: theme.colors.surface || '#222' }}></div>
            <div className="flex-1" style={{ backgroundColor: theme.colors.primary || '#666' }}></div>
         </div>
         <div className="p-3 bg-[var(--app-surface)] flex items-center justify-between">
            <div className="flex items-center gap-2">
               {isActive && <div className="w-2 h-2 rounded-full bg-[var(--app-primary)] shadow-sm animate-pulse"></div>}
               <span className={`text-xs font-bold ${isActive ? 'text-[var(--app-primary)]' : 'text-[var(--app-text)]'}`}>{theme.name}</span>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
               <button onClick={(e) => { e.stopPropagation(); onEdit(e); }} className="p-1.5 hover:bg-[var(--app-bg)] rounded-md text-[var(--app-text-muted)] hover:text-[var(--app-text)]" title="Edit/Copy">
                  {theme.isCustom ? <Edit2 size={12} /> : <Copy size={12} />}
               </button>
               {theme.isCustom && onDelete && (
                  <button onClick={(e) => { e.stopPropagation(); onDelete(e); }} className="p-1.5 hover:bg-red-500/10 rounded-md text-[var(--app-text-muted)] hover:text-red-500" title="Delete">
                     <Trash2 size={12} />
                  </button>
               )}
            </div>
         </div>
      </div>
   );
};

export const AppearanceTab: React.FC<AppearanceTabProps> = ({ settings, onUpdateSettings }) => {
   const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
   const [editedTheme, setEditedTheme] = useState<AppTheme | null>(null);
   const [currentPage, setCurrentPage] = useState(1);

   const startEditingTheme = (theme: AppTheme) => {
      if (!theme.isCustom) {
         const clonedTheme: AppTheme = {
            ...theme,
            id: `custom-${Date.now()}`,
            name: `${theme.name} (Copy)`,
            isCustom: true
         };
         setEditedTheme(clonedTheme);
         setEditingThemeId(clonedTheme.id);
      } else {
         setEditingThemeId(theme.id);
         setEditedTheme({ ...theme });
      }
   };

   const handleSaveTheme = () => {
      if (!editedTheme) return;
      const currentThemes = settings.themes || DEFAULT_THEMES;
      const existingIndex = currentThemes.findIndex(t => t.id === editedTheme.id);
      let newThemes = [...currentThemes];
      if (existingIndex >= 0) newThemes[existingIndex] = editedTheme;
      else newThemes.push(editedTheme);

      onUpdateSettings({ ...settings, themes: newThemes, activeThemeId: editedTheme.id });
      setEditingThemeId(null);
      setEditedTheme(null);
   };

   const createNewTheme = () => {
      const newTheme: AppTheme = {
         id: `custom-${Date.now()}`,
         name: 'New Custom Theme',
         colors: { ...DEFAULT_THEMES[0].colors },
         isCustom: true
      };
      setEditedTheme(newTheme);
      setEditingThemeId(newTheme.id);
   };

   const deleteTheme = (id: string) => {
      if (window.confirm("Delete this theme?")) {
         const currentThemes = settings.themes || DEFAULT_THEMES;
         const newThemes = currentThemes.filter(t => t.id !== id);
         const newActiveId = settings.activeThemeId === id ? DEFAULT_THEMES[0].id : settings.activeThemeId;
         onUpdateSettings({ ...settings, themes: newThemes, activeThemeId: newActiveId });
      }
   };

   const itemsPerPage = (typeof settings.itemsPerPage === 'number' && settings.itemsPerPage > 0) ? settings.itemsPerPage : 9;
   const currentThemes = settings.themes || DEFAULT_THEMES;
   const totalPages = Math.ceil(currentThemes.length / itemsPerPage);
   const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));

   const startIndex = (safePage - 1) * itemsPerPage;
   const visibleThemes = currentThemes.slice(startIndex, startIndex + itemsPerPage);

   const handlePrev = () => setCurrentPage(p => Math.max(1, p - 1));
   const handleNext = () => setCurrentPage(p => Math.min(totalPages, p + 1));

   return (
      <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
         <div>
            <div className="flex items-center justify-between mb-6">
               <div>
                  <h3 className="text-xl font-bold mb-1">Theme Gallery</h3>
                  <p className="text-sm text-[var(--app-text-muted)]">Choose a visual style that suits you.</p>
               </div>
               {!editingThemeId && (
                  <button onClick={createNewTheme} className="flex items-center gap-2 px-4 py-2 bg-[var(--app-primary)] hover:opacity-90 text-white rounded-lg text-sm font-bold shadow-md transition-all">
                     <Plus size={16} /> Create Theme
                  </button>
               )}
            </div>

            {editingThemeId && editedTheme ? (
               <div className="bg-[var(--app-bg)]/50 p-6 rounded-2xl border border-[var(--app-border)] mb-6 animate-in zoom-in-95 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[var(--app-primary)]"></div>
                  <div className="flex items-center justify-between mb-6">
                     <h4 className="font-bold text-lg flex items-center gap-2">
                        <Palette size={20} className="text-[var(--app-primary)]" /> Customizing Theme
                     </h4>
                     <div className="flex gap-2">
                        <button onClick={() => { setEditingThemeId(null); setEditedTheme(null); }} className="px-3 py-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-surface)] text-sm font-medium transition-colors">Cancel</button>
                        <button onClick={handleSaveTheme} className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-green-900/20"><Save size={16} /> Save Changes</button>
                     </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <div>
                           <label className="text-xs font-bold text-[var(--app-text-muted)] block mb-1.5 uppercase tracking-wider">Theme Name</label>
                           <input type="text" value={editedTheme.name} onChange={(e) => editedTheme && setEditedTheme({ ...editedTheme, name: e.target.value })} className="w-full bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-sm text-[var(--app-text)] focus:ring-2 focus:ring-[var(--app-primary)] focus:border-transparent outline-none" />
                        </div>
                        <div className="p-4 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)]">
                           <p className="text-xs font-bold text-[var(--app-text-muted)] uppercase tracking-wider mb-3">Live Preview</p>
                           <div className="flex gap-2">
                              <div className="h-20 w-full rounded-lg shadow-inner" style={{ backgroundColor: editedTheme.colors?.bg }}></div>
                              <div className="h-20 w-full rounded-lg shadow-lg border border-white/10" style={{ backgroundColor: editedTheme.colors?.surface }}></div>
                              <div className="h-20 w-full rounded-lg shadow-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: editedTheme.colors?.primary }}>Btn</div>
                           </div>
                        </div>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {editedTheme.colors && Object.entries(editedTheme.colors).map(([key, val]) => (
                           <div key={key} className="bg-[var(--app-surface)] p-2 rounded-lg border border-[var(--app-border)] flex items-center gap-3">
                              <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-[var(--app-border)] shadow-sm flex-shrink-0 group">
                                 <input type="color" value={val} onChange={(e) => editedTheme && setEditedTheme({ ...editedTheme, colors: { ...editedTheme.colors, [key]: e.target.value } })} className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer border-none p-0 opacity-0" />
                                 <div className="w-full h-full" style={{ backgroundColor: val }}></div>
                              </div>
                              <div className="flex-1 min-w-0">
                                 <label className="text-[10px] font-bold text-[var(--app-text-muted)] block capitalize truncate mb-0.5">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                                 <span className="text-xs font-mono text-[var(--app-text)]">{val}</span>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            ) : (
               <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                     {visibleThemes.map(t => (
                        <ThemePreview
                           key={t.id}
                           theme={t}
                           isActive={settings.activeThemeId === t.id}
                           onClick={() => onUpdateSettings({ ...settings, activeThemeId: t.id })}
                           onEdit={() => startEditingTheme(t)}
                           onDelete={() => deleteTheme(t.id)}
                        />
                     ))}
                  </div>

                  {totalPages > 1 && (
                     <div className="flex justify-center items-center gap-4 pb-8">
                        <button
                           onClick={handlePrev}
                           disabled={safePage === 1}
                           className={`p-2 rounded-full border border-[var(--app-border)] transition-colors ${safePage === 1 ? 'text-[var(--app-text-muted)] opacity-50 cursor-not-allowed' : 'hover:bg-[var(--app-surface)] text-[var(--app-text)]'}`}
                        >
                           <ChevronLeft size={20} />
                        </button>

                        <span className="text-sm font-medium text-[var(--app-text-muted)]">
                           Page <span className="text-[var(--app-text)] font-bold">{safePage}</span> of {totalPages}
                        </span>

                        <button
                           onClick={handleNext}
                           disabled={safePage === totalPages}
                           className={`p-2 rounded-full border border-[var(--app-border)] transition-colors ${safePage === totalPages ? 'text-[var(--app-text-muted)] opacity-50 cursor-not-allowed' : 'hover:bg-[var(--app-surface)] text-[var(--app-text)]'}`}
                        >
                           <ChevronRight size={20} />
                        </button>
                     </div>
                  )}
               </>
            )}

            <h3 className="text-lg font-bold mb-4 mt-8 pt-6 border-t border-[var(--app-border)]">Display Options</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="p-4 bg-[var(--app-bg)]/50 rounded-xl border border-[var(--app-border)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-[var(--app-surface)] rounded-lg border border-[var(--app-border)]"><Grid size={20} className="text-[var(--app-text-muted)]" /></div>
                     <div><p className="font-bold text-sm">Items Per Page</p><p className="text-xs text-[var(--app-text-muted)]">Cards per grid view</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                     <input type="number" min="3" max="100" value={settings.itemsPerPage || 9} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val >= 0) onUpdateSettings({ ...settings, itemsPerPage: val }); }} className="w-16 bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--app-text)] rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[var(--app-primary)]" />
                  </div>
               </div>
               <div className="p-4 bg-[var(--app-bg)]/50 rounded-xl border border-[var(--app-border)] flex items-center justify-between cursor-pointer hover:bg-[var(--app-bg)] transition-colors" onClick={() => onUpdateSettings({ ...settings, compactMode: !settings.compactMode })}>
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-[var(--app-surface)] rounded-lg border border-[var(--app-border)]"><Minus size={20} className="text-[var(--app-text-muted)]" /></div>
                     <div><p className="font-bold text-sm">Compact Mode</p><p className="text-xs text-[var(--app-text-muted)]">Reduce padding size</p></div>
                  </div>
                  <button className={`w-10 h-5 rounded-full transition-colors relative ${settings.compactMode ? 'bg-[var(--app-primary)]' : 'bg-[var(--app-border)]'}`}>
                     <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${settings.compactMode ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
               </div>
               <div className="p-4 bg-[var(--app-bg)]/50 rounded-xl border border-[var(--app-border)] flex items-center justify-between cursor-pointer hover:bg-[var(--app-bg)] transition-colors" onClick={() => onUpdateSettings({ ...settings, reducedMotion: !settings.reducedMotion })}>
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-[var(--app-surface)] rounded-lg border border-[var(--app-border)]"><Activity size={20} className="text-[var(--app-text-muted)]" /></div>
                     <div><p className="font-bold text-sm">Reduced Motion</p><p className="text-xs text-[var(--app-text-muted)]">Disable smooth animations</p></div>
                  </div>
                  <button className={`w-10 h-5 rounded-full transition-colors relative ${settings.reducedMotion ? 'bg-[var(--app-primary)]' : 'bg-[var(--app-border)]'}`}>
                     <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${settings.reducedMotion ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
               </div>
            </div>
         </div>
      </div>
   );
};
