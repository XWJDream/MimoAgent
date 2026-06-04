import React, { useState, useEffect } from 'react';
import { Sparkles, Search, Code, Shuffle, Bug, TestTube, FileText, GitBranch, Layout, Zap } from 'lucide-react';
import { useT } from '../../i18n';

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

export function SkillPanel() {
  const t = useT();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [matches, setMatches] = useState<SkillMatch[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [activeSkill, setActiveSkill] = useState<string | null>(null);

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      const result = await window.api?.skills?.list();
      if (result?.skills) {
        setSkills(result.skills);
      }
    } catch (err) {
      console.error('Failed to load skills:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchInput.trim()) {
      setMatches([]);
      return;
    }
    try {
      const result = await window.api?.skills?.match(searchInput);
      if (result?.matches) {
        setMatches(result.matches);
      }
    } catch (err) {
      console.error('Failed to match skills:', err);
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
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={18} strokeWidth={1.7} style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('skills.title') || '智能技能'}
          </h2>
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
            style={{
              background: 'var(--accent)',
              color: 'white',
              borderRadius: 8,
              padding: '8px 12px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Search size={16} />
          </button>
        </div>
      </div>

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
