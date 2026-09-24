import type { Edit } from './math';

export class EditHistory {
  private past: Edit[] = [];
  private future: Edit[] = [];
  private lastTyping = 0;
  current: Edit;
  constructor(text: string) {
    this.current = { text, start: 0, end: 0 };
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  selection(start: number, end: number) {
    this.current = { ...this.current, start, end };
  }
  commit(edit: Edit, typing = false, now = Date.now()) {
    if (edit.text === this.current.text) {
      this.current = edit;
      return;
    }
    if (!typing || !this.lastTyping || now - this.lastTyping > 700 || this.future.length) {
      this.past.push(this.current);
      if (this.past.length > 200) this.past.shift();
    }
    this.current = edit;
    this.future = [];
    this.lastTyping = typing ? now : 0;
  }
  breakGroup() {
    this.lastTyping = 0;
  }
  undo() {
    const previous = this.past.pop();
    if (previous) {
      this.future.push(this.current);
      this.current = previous;
    }
    this.breakGroup();
    return this.current;
  }
  redo() {
    const next = this.future.pop();
    if (next) {
      this.past.push(this.current);
      this.current = next;
    }
    this.breakGroup();
    return this.current;
  }
}
