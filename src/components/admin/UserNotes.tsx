import { useState } from "react";
import { format } from "date-fns";
import { StickyNote, Trash2, Plus, Tag } from "lucide-react";
import { useAdminUserNotes, useAddUserNote, useDeleteUserNote, type UserNote } from "@/hooks/admin/useAdminUserNotes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TAGS = ["VIP", "Churning", "Spam", "Support", "Potential"];
const TAG_COLORS: Record<string, string> = {
  VIP: "bg-purple/10 text-purple border-purple/20",
  Churning: "bg-warning/10 text-warning border-warning/20",
  Spam: "bg-destructive/10 text-destructive border-destructive/20",
  Support: "bg-info/10 text-info border-info/20",
  Potential: "bg-primary/10 text-primary border-primary/20",
};

interface UserNotesProps {
  userId: string;
}

export function UserNotes({ userId }: UserNotesProps) {
  const { data: notes, isLoading } = useAdminUserNotes(userId);
  const { mutate: addNote, isPending: isAdding } = useAddUserNote();
  const { mutate: deleteNote } = useDeleteUserNote();
  const [newNote, setNewNote] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("");

  const handleAdd = () => {
    if (!newNote.trim()) return;
    addNote(
      { userId, note: newNote.trim(), tag: selectedTag || undefined },
      { onSuccess: () => { setNewNote(""); setSelectedTag(""); } }
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-warning" /> Internal Notes
        </CardTitle>
        <CardDescription>Admin notes and tags for this user</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Note Form */}
        <div className="space-y-3 p-4 rounded-lg bg-card/50 border border-border/30">
          <Textarea
            placeholder="Add a note about this user..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="bg-background/50 min-h-[80px]"
          />
          <div className="flex items-center gap-2">
            <Select value={selectedTag || "none"} onValueChange={(v) => setSelectedTag(v === "none" ? "" : v)}>
              <SelectTrigger className="w-[140px] bg-background/50">
                <Tag className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Tag</SelectItem>
                {TAGS.map(tag => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAdd} disabled={isAdding || !newNote.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add Note
            </Button>
          </div>
        </div>

        {/* Notes List */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-16 shimmer rounded" />)}
          </div>
        ) : (!notes || notes.length === 0) ? (
          <p className="text-center py-6 text-muted-foreground text-sm">No notes yet</p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="p-3 rounded-lg bg-card/50 border border-border/30 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{note.note}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {note.tag && (
                        <Badge className={cn("text-xs", TAG_COLORS[note.tag] || "bg-muted text-muted-foreground border-border")}>
                          {note.tag}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {note.adminEmail} • {format(new Date(note.created_at), "MMM d, HH:mm")}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => deleteNote({ noteId: note.id, userId })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
