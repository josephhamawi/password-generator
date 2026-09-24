import { Component } from '@angular/core';

import { BLOG_POSTS, BlogPost, KODE_FOUNDRY_URL } from '../data/blog-posts';

interface Block {
  kind: 'heading' | 'item' | 'para';
  text: string;
  /** Set when the paragraph carries the outbound link. */
  before?: string;
  linkText?: string;
  after?: string;
}

@Component({
  selector: 'app-blog-panel',
  templateUrl: './blog-panel.component.html',
  styleUrls: ['./blog-panel.component.scss']
})
export class BlogPanelComponent {
  posts: BlogPost[] = BLOG_POSTS;
  open: BlogPost = null;

  readonly foundryUrl = KODE_FOUNDRY_URL;

  read(post: BlogPost): void {
    this.open = post;
  }

  back(): void {
    this.open = null;
  }

  /** Splits a body into renderable blocks, resolving the {LINK} placeholder. */
  blocks(post: BlogPost): Block[] {
    return post.body.map(line => {
      if (line.indexOf('## ') === 0) {
        return { kind: 'heading', text: line.slice(3) } as Block;
      }
      if (line.indexOf('- ') === 0) {
        return { kind: 'item', text: line.slice(2) } as Block;
      }
      const at = line.indexOf('{LINK}');
      if (at !== -1) {
        return {
          kind: 'para',
          text: '',
          before: line.slice(0, at),
          linkText: post.link.text,
          after: line.slice(at + 6)
        } as Block;
      }
      return { kind: 'para', text: line } as Block;
    });
  }
}
