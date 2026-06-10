import React, { useState, useEffect } from 'react';
import { Sparkles, Search, Code, Shuffle, Bug, TestTube, FileText, GitBranch, Layout, Zap, X } from 'lucide-react';
import { useT } from '../../i18n';
import { useToast } from '../common/Toast';

interface Skill {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  icon?: string;
  priority: number;
}

interface SkillMatch {
  skill: Skill;
  confidence: number;
  matchedTriggers: string[];
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  Search, Code, Shuffle, Bug, TestTube, FileText, GitBranch, Layout, Zap,
};

interface SkillPanelProps {
  onClose: () => void;
}

export function SkillPanel({ onClose }: SkillPanelProps) {
  const t = useT();
  const { toast } = useToast();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [matches, setMatches] = useState<SkillMatch[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    setIsLoading(true);
    try {
      const result = await window.api?.skills?.list();
      if (result?.skills) {
        setSkills(result.skills);
      }
    } catch (err) {
      console.error('Failed to load skills:', err);
      toast('加载技能失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchInput.trim()) {
      setMatches([]);
      setHasSearched(false);
      return;
    }
    setIsLoading(true);
    setHasSearched(true);
    try {
      const result = await window.api?.skills?.match(searchInput);
      if (result?.matches) {
        setMatches(result.matches);
      }
    } catch (err) {
      console.error('Failed to match skills:', err);
      toast('搜索失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateSkill = (skillId: string) => {
    setActiveSkill(activeSkill === skillId ? null : skillId);
  };

  const getIcon = (iconName?: string) => {
    if (!iconName || !ICON_MAP[iconName]) return Sparkles;
    return ICON_MAP[iconName];
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} strokeWidth={1.7} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {t('skills.title') || '智能技能'}
            </h2>
          </div>
          <button onClick={onClose} className="icon-button" title={t('common.close') || '关闭'}>
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('skills.searchPlaceholder') || '描述你的需求...'}
            className="flex-1 text-sm"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '8px 12px',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          <button
            onClick={handleSearch}
            disabled={isLoading}
            style={{
              background: 'var(--accent)',
              color: 'white',
              borderRadius: 8,
              padding: '8px 12px',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? '...' : <Search size={16} />}
          </button>
        </div>
      </div>

      {/* No Matches */}
      {hasSearched && matches.length === 0 && !isLoading && (
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-center gap-2 py-3" style={{ color: 'var(--text-muted)' }}>
            <Search size={14} />
            <span className="text-sm">未找到匹配的技能</span>
          </div>
        </div>
      )}

      {/* Matched Skills */}
      {matches.length > 0 && (
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
            {t('skills.matchedSkills') || '匹配的技能'}
          </h3>
          <div className="flex flex-col gap-2">
            {matches.map((match) => {
              const Icon = getIcon(match.skill.icon);
              return (
                <div
                  key={match.skill.id}
                  className="p-3 rounded-lg cursor-pointer"
                  style={{
                    background: activeSkill === match.skill.id ? 'var(--accent-bg)' : 'var(--bg-surface)',
                    border: `1px solid ${activeSkill === match.skill.id ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  }}
                  onClick={() => handleActivateSkill(match.skill.id)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={14} strokeWidth={1.7} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {match.skill.name}
                    </span>
                    <span className="text-xs ml-auto" style={{ color: 'var(--success)' }}>
                      {Math.round(match.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {match.skill.description}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {match.matchedTriggers.map((trigger, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          background: 'var(--accent-bg)',
                          color: 'var(--accent)',
                        }}
                      >
                        {trigger}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Skills */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
          {t('skills.allSkills') || '所有技能'}
        </h3>
        <div className="flex flex-col gap-2">
          {isLoading && skills.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
              <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>加载中...</span>
            </div>
          )}
          {skills.map((skill) => {
            const Icon = getIcon(skill.icon);
            return (
              <div
                key={skill.id}
                className="p-3 rounded-lg cursor-pointer"
                style={{
                  background: activeSkill === skill.id ? 'var(--accent-bg)' : 'var(--bg-surface)',
                  border: `1px solid ${activeSkill === skill.id ? 'var(--accent)' : 'var(--border-subtle)'}`,
                }}
                onClick={() => handleActivateSkill(skill.id)}
              >
                <div className="flex items-center gap-2">
                  <Icon size={14} strokeWidth={1.7} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {skill.name}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {skill.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
