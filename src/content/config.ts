import { defineCollection, z } from 'astro:content';

const writeups = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    tags: z.array(z.string()),
    difficulty: z.enum(['easy', 'medium', 'hard', 'insane']),
    platform: z.enum(['HTB', 'THM', 'CTF', 'Other']),
    description: z.string(),
    featured: z.boolean().default(false),
    // New design: the dithered header scene (from scenes.js) and the attack
    // chain shown as a rail. Optional so older entries still validate.
    scene: z.string().optional(),
    chain: z.array(z.string()).optional(),
  }),
});

export const collections = { writeups };
