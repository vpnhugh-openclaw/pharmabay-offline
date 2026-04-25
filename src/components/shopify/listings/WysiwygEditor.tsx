import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Link as LinkIcon, AlignLeft, AlignCenter,
  AlignRight, Heading1, Heading2, Heading3, Code, Undo, Redo,
} from "lucide-react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function WysiwygEditor({ value, onChange, placeholder }: Props) {
  const [htmlMode, setHtmlMode] = useState(false);
  const [rawHtml, setRawHtml] = useState(value ?? "");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value ?? "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setRawHtml(html);
      onChange(html);
    },
  });

  // Sync external value changes into the editor (e.g. when a new product loads)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value ?? "", false);
      setRawHtml(value ?? "");
    }
  }, [value, editor]);

  const toggleHtmlMode = () => {
    if (!editor) return;
    if (!htmlMode) {
      // Switching to HTML mode — capture current editor output
      setRawHtml(editor.getHTML());
    } else {
      // Switching back to visual — load raw HTML into editor
      editor.commands.setContent(rawHtml, false);
      onChange(rawHtml);
    }
    setHtmlMode(!htmlMode);
  };

  const handleRawChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRawHtml(e.target.value);
    onChange(e.target.value);
  };

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href ?? "";
    const url = window.prompt("Enter URL", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  const btn = (active: boolean) =>
    `h-7 w-7 p-0 rounded ${active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`;

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1.5">
        <button className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><Bold className="h-3.5 w-3.5" /></button>
        <button className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><Italic className="h-3.5 w-3.5" /></button>
        <button className={btn(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><UnderlineIcon className="h-3.5 w-3.5" /></button>
        <button className={btn(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough"><Strikethrough className="h-3.5 w-3.5" /></button>

        <div className="w-px h-5 bg-border mx-1" />

        <button className={btn(editor.isActive("heading", { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="H1"><Heading1 className="h-3.5 w-3.5" /></button>
        <button className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="H2"><Heading2 className="h-3.5 w-3.5" /></button>
        <button className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="H3"><Heading3 className="h-3.5 w-3.5" /></button>

        <div className="w-px h-5 bg-border mx-1" />

        <button className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list"><List className="h-3.5 w-3.5" /></button>
        <button className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"><ListOrdered className="h-3.5 w-3.5" /></button>
        <button className={btn(editor.isActive("codeBlock"))} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code block"><Code className="h-3.5 w-3.5" /></button>

        <div className="w-px h-5 bg-border mx-1" />

        <button className={btn(editor.isActive({ textAlign: "left" }))} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Align left"><AlignLeft className="h-3.5 w-3.5" /></button>
        <button className={btn(editor.isActive({ textAlign: "center" }))} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Align centre"><AlignCenter className="h-3.5 w-3.5" /></button>
        <button className={btn(editor.isActive({ textAlign: "right" }))} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Align right"><AlignRight className="h-3.5 w-3.5" /></button>

        <div className="w-px h-5 bg-border mx-1" />

        <button className={btn(editor.isActive("link"))} onClick={setLink} title="Insert / edit link"><LinkIcon className="h-3.5 w-3.5" /></button>

        <div className="w-px h-5 bg-border mx-1" />

        <button className={btn(false)} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo"><Undo className="h-3.5 w-3.5" /></button>
        <button className={btn(false)} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo"><Redo className="h-3.5 w-3.5" /></button>

        <div className="ml-auto">
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={toggleHtmlMode}>
            {htmlMode ? "Visual" : "HTML"}
          </Button>
        </div>
      </div>

      {/* Editor area */}
      {htmlMode ? (
        <textarea
          className="w-full min-h-[280px] p-3 font-mono text-xs bg-background resize-y focus:outline-none"
          value={rawHtml}
          onChange={handleRawChange}
          placeholder="Raw HTML…"
          spellCheck={false}
        />
      ) : (
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none min-h-[280px] p-3 focus-within:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[260px]"
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
