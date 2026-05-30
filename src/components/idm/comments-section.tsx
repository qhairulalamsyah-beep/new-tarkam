'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, Trash2, Reply, Loader2, LogIn } from 'lucide-react';
import { useComments } from '@/lib/hooks';
import { createComment, deleteComment } from '@/lib/queries/misc';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import { getAvatarUrl, toStrictDivision } from '@/lib/utils';
import { AvatarMedia } from '@/components/ui/avatar-media';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

/* ─── Props ─── */
export interface CommentsSectionProps {
  targetType: string;
  targetId: string;
  className?: string;
}

/* ─── Comment Author Type ─── */
interface CommentAuthor {
  id: string;
  username: string;
  gamertag: string | null;
  avatar: string | null;
  division: string | null;
  tier: string | null;
}

interface CommentData {
  id: string;
  content: string;
  targetType: string;
  targetId: string;
  parentId: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  isOwn: boolean;
  author: CommentAuthor | null;
  replies?: CommentData[];
}

/* ─── Time ago helper ─── */
function timeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: idLocale });
  } catch {
    return '';
  }
}

/* ─── Tier badge color ─── */
function tierClass(tier: string | null): string {
  if (tier === 'S') return 'bg-idm-gold-warm/15 text-idm-gold-warm';
  if (tier === 'A') return 'bg-purple-500/15 text-purple-500';
  return 'bg-muted/30 text-muted-foreground';
}

/* ─── Single Comment Item ─── */
function CommentItem({
  comment,
  onReply,
  onDelete,
  isReplying,
  onReplySubmit,
  onReplyCancel,
  replyContent,
  onReplyContentChange,
  isSubmittingReply,
  isDeleting,
  depth = 0,
}: {
  comment: CommentData;
  onReply: (id: string) => void;
  onDelete: (id: string) => void;
  isReplying: boolean;
  onReplySubmit: () => void;
  onReplyCancel: () => void;
  replyContent: string;
  onReplyContentChange: (val: string) => void;
  isSubmittingReply: boolean;
  isDeleting: boolean;
  depth?: number;
}) {
  const isTopLevel = depth === 0;
  const author = comment.author;

  return (
    <div className={`${isTopLevel ? '' : 'ml-8 mt-2'}`}>
      <div className={`flex gap-2.5 ${isTopLevel ? 'py-3' : 'py-2'} ${isTopLevel ? 'border-b border-border/10 last:border-b-0' : ''}`}>
        {/* Avatar */}
        <div className={`shrink-0 ${isTopLevel ? 'w-8 h-8' : 'w-6 h-6'} rounded-full overflow-hidden`}>
          {author?.avatar && author?.gamertag && author?.division ? (
            <AvatarMedia
              src={getAvatarUrl(author.gamertag, toStrictDivision(author.division), author.avatar)}
              alt={author.gamertag}
              width={isTopLevel ? 32 : 24}
              height={isTopLevel ? 32 : 24}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-muted/30 flex items-center justify-center">
              <span className={`${isTopLevel ? 'text-[10px]' : 'text-[8px]'} font-bold text-muted-foreground/50`}>
                {(author?.gamertag || author?.username || '?')[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-foreground/90 truncate">
              {author?.gamertag || author?.username || 'Anonim'}
            </span>
            {author?.tier && (
              <span className={`text-[7px] font-bold px-1 py-0 rounded ${tierClass(author.tier)}`}>
                {author.tier}
              </span>
            )}
            <span className="text-[9px] text-muted-foreground/50">
              {timeAgo(comment.createdAt)}
            </span>
          </div>
          <p className="text-xs text-foreground/80 mt-0.5 break-words whitespace-pre-wrap">{comment.content}</p>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-1.5">
            {isTopLevel && (
              <button
                onClick={() => onReply(comment.id)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-idm-gold-warm transition-colors cursor-pointer"
                aria-label="Balas komentar"
              >
                <Reply className="w-3 h-3" />
                <span>Balas</span>
              </button>
            )}
            {comment.isOwn && !comment.isDeleted && (
              <button
                onClick={() => onDelete(comment.id)}
                disabled={isDeleting}
                className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
                aria-label="Hapus komentar"
              >
                <Trash2 className="w-3 h-3" />
                <span>{isDeleting ? 'Menghapus...' : 'Hapus'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reply input */}
      <AnimatePresence>
        {isReplying && (
          <motion.div
            className="ml-8 mt-1 mb-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={replyContent}
                onChange={(e) => onReplyContentChange(e.target.value)}
                placeholder="Tulis balasan..."
                className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-muted/10 border border-border/20 focus:border-idm-gold-warm/30 focus:outline-none focus:ring-1 focus:ring-idm-gold-warm/20 transition-all placeholder:text-muted-foreground/30"
                maxLength={1000}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && replyContent.trim()) {
                    e.preventDefault();
                    onReplySubmit();
                  }
                  if (e.key === 'Escape') onReplyCancel();
                }}
                autoFocus
              />
              <button
                onClick={onReplySubmit}
                disabled={!replyContent.trim() || isSubmittingReply}
                className="w-7 h-7 rounded-lg bg-idm-gold-warm/10 text-idm-gold-warm flex items-center justify-center hover:bg-idm-gold-warm/20 transition-colors disabled:opacity-30 cursor-pointer shrink-0"
                aria-label="Kirim balasan"
              >
                {isSubmittingReply ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={onReplyCancel}
                className="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-8 border-l border-border/10 pl-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={() => {}}
              onDelete={onDelete}
              isReplying={false}
              onReplySubmit={() => {}}
              onReplyCancel={() => {}}
              replyContent=""
              onReplyContentChange={() => {}}
              isSubmittingReply={false}
              isDeleting={isDeleting}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─── */
export function CommentsSection({ targetType, targetId, className }: CommentsSectionProps) {
  const queryClient = useQueryClient();
  const playerAuth = useAppStore(s => s.playerAuth);
  const isLoggedIn = playerAuth.isAuthenticated;

  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch comments
  const { data: commentsData, isLoading } = useComments(
    { targetType, targetId, cursor: nextCursor || undefined, limit: 20 },
    { enabled: !!targetId }
  );

  const comments: CommentData[] = commentsData?.comments || [];
  const total = commentsData?.total || 0;
  const hasMore = commentsData?.hasMore || false;
  const cursor = commentsData?.nextCursor || null;

  // Submit new comment
  const handleSubmit = useCallback(async () => {
    if (!newComment.trim() || !isLoggedIn || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createComment({
        content: newComment.trim(),
        targetType,
        targetId,
      });
      setNewComment('');
      await queryClient.invalidateQueries({ queryKey: ['comments', targetType, targetId] });
    } catch (err) {
      console.error('Failed to create comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [newComment, isLoggedIn, isSubmitting, targetType, targetId, queryClient]);

  // Submit reply
  const handleReplySubmit = useCallback(async (parentId: string) => {
    if (!replyContent.trim() || !isLoggedIn || isSubmittingReply) return;
    setIsSubmittingReply(true);
    try {
      await createComment({
        content: replyContent.trim(),
        targetType,
        targetId,
        parentId,
      });
      setReplyContent('');
      setReplyingToId(null);
      await queryClient.invalidateQueries({ queryKey: ['comments', targetType, targetId] });
    } catch (err) {
      console.error('Failed to create reply:', err);
    } finally {
      setIsSubmittingReply(false);
    }
  }, [replyContent, isLoggedIn, isSubmittingReply, targetType, targetId, queryClient]);

  // Delete comment
  const handleDelete = useCallback(async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deleteComment(id);
      await queryClient.invalidateQueries({ queryKey: ['comments', targetType, targetId] });
    } catch (err) {
      console.error('Failed to delete comment:', err);
    } finally {
      setDeletingId(null);
    }
  }, [deletingId, targetType, targetId, queryClient]);

  // Load more
  const handleLoadMore = useCallback(() => {
    if (cursor) {
      setNextCursor(cursor);
    }
  }, [cursor]);

  return (
    <div className={`space-y-3 ${className || ''}`}>
      {/* Section label */}
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-idm-gold-warm/10 flex items-center justify-center shrink-0">
          <MessageCircle className="w-2.5 h-2.5 text-idm-gold-warm" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Komentar</span>
        {total > 0 && (
          <span className="text-[9px] text-muted-foreground/60 ml-auto">{total} komentar</span>
        )}
      </div>

      {/* Comment Input */}
      {isLoggedIn ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Tulis komentar..."
            className="flex-1 text-xs px-3 py-2 rounded-lg bg-muted/10 border border-border/20 focus:border-idm-gold-warm/30 focus:outline-none focus:ring-1 focus:ring-idm-gold-warm/20 transition-all placeholder:text-muted-foreground/30"
            maxLength={1000}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && newComment.trim()) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || isSubmitting}
            className="w-8 h-8 rounded-lg bg-idm-gold-warm/10 text-idm-gold-warm flex items-center justify-center hover:bg-idm-gold-warm/20 transition-colors disabled:opacity-30 cursor-pointer shrink-0"
            aria-label="Kirim komentar"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/5 border border-border/10">
          <LogIn className="w-3.5 h-3.5 text-muted-foreground/40" />
          <span className="text-[11px] text-muted-foreground/50">Login untuk berkomentar</span>
        </div>
      )}

      {/* Comments List */}
      <div className="max-h-96 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="py-6 text-center">
            <Loader2 className="w-5 h-5 text-idm-gold-warm/50 animate-spin mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground/50">Memuat komentar...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="py-6 text-center">
            <MessageCircle className="w-6 h-6 text-muted-foreground/15 mx-auto mb-2" />
            <p className="text-[11px] text-muted-foreground/40 font-medium">Belum ada komentar. Jadilah yang pertama!</p>
          </div>
        ) : (
          <div className="space-y-0">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onReply={(id) => {
                  setReplyingToId(id);
                  setReplyContent('');
                }}
                onDelete={handleDelete}
                isReplying={replyingToId === comment.id}
                onReplySubmit={() => handleReplySubmit(comment.id)}
                onReplyCancel={() => {
                  setReplyingToId(null);
                  setReplyContent('');
                }}
                replyContent={replyContent}
                onReplyContentChange={setReplyContent}
                isSubmittingReply={isSubmittingReply}
                isDeleting={deletingId === comment.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-1">
          <button
            onClick={handleLoadMore}
            className="text-[10px] font-semibold text-idm-gold-warm/60 hover:text-idm-gold-warm transition-colors cursor-pointer"
          >
            Muat lebih banyak komentar...
          </button>
        </div>
      )}
    </div>
  );
}
