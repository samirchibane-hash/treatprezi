import { useState } from 'react';
import { Bell, Plus, X, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  is_system: boolean;
  created_at: string;
  posted_by: string;
}

interface UpdatesCardProps {
  announcements: Announcement[];
  isAdmin: boolean;
  dealershipId: string;
  userId: string;
  onAnnouncementAdded: (a: Announcement) => void;
  onAnnouncementDeleted: (id: string) => void;
}

export function UpdatesCard({
  announcements,
  isAdmin,
  dealershipId,
  userId,
  onAnnouncementAdded,
  onAnnouncementDeleted,
}: UpdatesCardProps) {
  const { toast } = useToast();
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePost = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        dealership_id: dealershipId,
        posted_by: userId,
        title: title.trim(),
        body: body.trim(),
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: 'Could not post update.', variant: 'destructive' });
    } else if (data) {
      onAnnouncementAdded(data as Announcement);
      setTitle('');
      setBody('');
      setComposing(false);
      toast({ title: 'Posted', description: 'Update published to your team.' });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (!error) {
      onAnnouncementDeleted(id);
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gradient-water flex items-center justify-center">
            <Bell className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground tracking-tight">Updates</p>
            <p className="text-[11px] text-muted-foreground">From your team</p>
          </div>
        </div>
        {isAdmin && !composing && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary"
            onClick={() => setComposing(true)}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Compose */}
      {composing && (
        <div className="px-5 py-4 border-b border-border/40 bg-muted/30 space-y-2">
          <input
            className="w-full text-[13px] font-medium bg-transparent border-0 border-b border-border/60 pb-1.5 focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/60"
            placeholder="Title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="w-full text-[13px] bg-transparent border-0 focus:outline-none text-foreground placeholder:text-muted-foreground/60 resize-none"
            placeholder="Write your update…"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex items-center gap-2 justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[12px] text-muted-foreground"
              onClick={() => { setComposing(false); setTitle(''); setBody(''); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-[12px] rounded-lg bg-primary text-primary-foreground"
              onClick={handlePost}
              disabled={saving || !title.trim() || !body.trim()}
            >
              {saving ? 'Posting…' : 'Post Update'}
            </Button>
          </div>
        </div>
      )}

      {/* Feed */}
      <div className="divide-y divide-border/30 max-h-72 overflow-y-auto">
        {announcements.length === 0 ? (
          <div className="py-10 text-center px-5">
            <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Megaphone className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-[13px] text-muted-foreground">
              {isAdmin ? 'Post your first team update.' : 'No updates yet.'}
            </p>
          </div>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="group px-5 py-3.5 relative">
              {isAdmin && a.posted_by === userId && (
                <button
                  onClick={() => handleDelete(a.id)}
                  className="absolute right-4 top-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <div className="flex items-start gap-2.5 pr-4">
                {a.is_system ? (
                  <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-accent" />
                ) : (
                  <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground leading-tight">{a.title}</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{a.body}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
