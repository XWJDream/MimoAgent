import React, { useState, useCallback, useEffect } from 'react';
import { Shield, AlertTriangle, Terminal, FileEdit } from 'lucide-react';
import { DiffViewer } from './DiffViewer';
import { useToast } from '../common/Toast';

export interface PermissionRequest {
  id: string;
  toolName: string;
  description: string;
  args: Record<string, unknown>;
  riskLevel: 'read' | 'write' | 'execute' | 'destructive';
  diff?: { old: string; new: string; filePath?: string };
  command?: string;
}

interface PermissionDialogProps {
  request: PermissionRequest;
  onAllow: (always: boolean) => void;
  onReject: (feedback?: string) => void;
}

const RISK_CONFIG: Record<
  string,
  { color: string; bgColor: string; label: string; icon: typeof Shield }
> = {
  read: { color: 'var(--success)', bgColor: 'rgba(34,197,94,0.1)', label: '读取', icon: Shield },
  write: { color: 'var(--warning)', bgColor: 'rgba(234,179,8,0.1)', label: '写入', icon: FileEdit },
  execute: { color: 'var(--error)', bgColor: 'rgba(239,68,68,0.1)', label: '执行', icon: Terminal },
  destructive: {
    color: 'var(--error)',
    bgColor: 'rgba(239,68,68,0.15)',
    label: '危险',
    icon: AlertTriangle,
  },
};

export function PermissionDialog({ request, onAllow, onReject }: PermissionDialogProps) {
  const { toast } = useToast();
  const [showRejectFeedback, setShowRejectFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const risk = RISK_CONFIG[request.riskLevel] || RISK_CONFIG.read;
  const RiskIcon = risk.icon;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showRejectFeedback) {
          setShowRejectFeedback(false);
          setFeedback('');
        } else {
          handleReject();
        }
      }
      // Enter to allow once (when not in feedback mode)
      if (e.key === 'Enter' && !showRejectFeedback && !e.shiftKey) {
        e.preventDefault();
        handleAllow(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showRejectFeedback, feedback]);

  const handleAllow = useCallback(
    async (always: boolean) => {
      if (isProcessing) return;
      setIsProcessing(true);
      try {
        onAllow(always);
        if (always) {
          toast('已设置为始终允许此操作', 'success');
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, onAllow, toast],
  );

  const handleReject = useCallback(() => {
    if (showRejectFeedback) {
      onReject(feedback || undefined);
      toast('已拒绝操作', 'info');
    } else {
      setShowRejectFeedback(true);
    }
  }, [showRejectFeedback, feedback, onReject, toast]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
    >
      <div
        style={{
          background: 'var(--bg-base)',
          borderRadius: 12,
          width: '90%',
          maxWidth: 620,
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: risk.bgColor,
              flexShrink: 0,
            }}
          >
            <RiskIcon size={18} style={{ color: risk.color }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                color: 'var(--text-primary)',
                fontSize: 14,
              }}
            >
              权限请求: {request.toolName}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {request.description}
            </div>
          </div>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 6,
              background: risk.bgColor,
              color: risk.color,
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {risk.label}
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {/* Diff preview (for file edits) */}
          {request.diff && (
            <div style={{ marginBottom: 16 }}>
              <DiffViewer
                old={request.diff.old}
                new={request.diff.new}
                filePath={request.diff.filePath}
              />
            </div>
          )}

          {/* Shell command preview */}
          {request.command && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  marginBottom: 8,
                  fontWeight: 500,
                }}
              >
                执行命令
              </div>
              <pre
                style={{
                  background: 'var(--bg-surface)',
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  overflow: 'auto',
                  border: '1px solid var(--border-subtle)',
                  margin: 0,
                }}
              >
                $ {request.command}
              </pre>
            </div>
          )}

          {/* Args summary (fallback when no diff or command) */}
          {!request.diff && !request.command && (
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  marginBottom: 8,
                  fontWeight: 500,
                }}
              >
                参数详情
              </div>
              <pre
                style={{
                  background: 'var(--bg-surface)',
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                  maxHeight: 200,
                  overflow: 'auto',
                  border: '1px solid var(--border-subtle)',
                  margin: 0,
                }}
              >
                {JSON.stringify(request.args, null, 2)}
              </pre>
            </div>
          )}

          {/* Reject feedback input */}
          {showRejectFeedback && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  marginBottom: 8,
                  fontWeight: 500,
                }}
              >
                反馈消息（可选，告诉 Agent 如何改进）
              </div>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="例如：请先检查文件是否存在..."
                autoFocus
                style={{
                  width: '100%',
                  minHeight: 60,
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <button
            onClick={handleReject}
            disabled={isProcessing}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: showRejectFeedback ? 'none' : '1px solid var(--border-subtle)',
              background: showRejectFeedback ? 'var(--error)' : 'transparent',
              color: showRejectFeedback ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: showRejectFeedback ? 500 : 400,
              opacity: isProcessing ? 0.6 : 1,
              transition: 'all 150ms ease',
            }}
          >
            {showRejectFeedback ? '确认拒绝' : '拒绝'}
          </button>
          <button
            onClick={() => handleAllow(false)}
            disabled={isProcessing}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--accent)',
              color: 'white',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              opacity: isProcessing ? 0.6 : 1,
              transition: 'all 150ms ease',
            }}
          >
            允许一次
          </button>
          <button
            onClick={() => handleAllow(true)}
            disabled={isProcessing}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--success)',
              color: 'white',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              opacity: isProcessing ? 0.6 : 1,
              transition: 'all 150ms ease',
            }}
          >
            始终允许
          </button>
        </div>

        {/* Keyboard hints */}
        <div
          style={{
            padding: '6px 20px 8px',
            fontSize: 11,
            color: 'var(--text-muted)',
            textAlign: 'center',
            borderTop: '1px solid var(--border-subtle)',
            opacity: 0.7,
          }}
        >
          Enter 允许一次 | Esc 拒绝
        </div>
      </div>
    </div>
  );
}
