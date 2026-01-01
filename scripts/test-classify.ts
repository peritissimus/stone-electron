/**
 * Test script for topic classification
 */
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

const DB_PATH = path.join(__dirname, '../data/notes.db');

// Keywords for classification
const TOPIC_KEYWORDS: Record<string, string[]> = {
  topic_work: ['meeting', 'project', 'deadline', 'client', 'work', 'office', 'team', 'sprint', 'standup', 'review', 'report', 'email', 'colleague', 'manager', 'task', 'milestone', 'stakeholder', 'presentation', 'agenda'],
  topic_personal: ['personal', 'journal', 'diary', 'reflection', 'life', 'family', 'friend', 'hobby', 'health', 'goal', 'dream', 'gratitude', 'feeling', 'emotion', 'self', 'home', 'weekend', 'vacation'],
  topic_learning: ['learn', 'study', 'course', 'tutorial', 'book', 'reading', 'education', 'skill', 'practice', 'lesson', 'concept', 'understand', 'knowledge', 'research', 'notes', 'class', 'lecture', 'training'],
  topic_projects: ['project', 'build', 'develop', 'implement', 'design', 'feature', 'architecture', 'code', 'api', 'database', 'deploy', 'release', 'version', 'roadmap', 'requirements', 'spec', 'technical'],
  topic_ideas: ['idea', 'brainstorm', 'concept', 'thought', 'maybe', 'could', 'might', 'explore', 'experiment', 'innovation', 'creative', 'possibility', 'potential', 'consider', 'imagine', 'what if', 'future'],
};

function classifyText(text: string): { topicId: string; confidence: number; matched: string[] }[] {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  const wordSet = new Set(words);
  const scores: { topicId: string; confidence: number; matched: string[] }[] = [];

  for (const [topicId, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    let matchCount = 0;
    const matchedKeywords: string[] = [];

    for (const keyword of keywords) {
      if (wordSet.has(keyword) || lowerText.includes(keyword)) {
        matchCount++;
        matchedKeywords.push(keyword);
      }
    }

    if (matchCount > 0) {
      const confidence = Math.min(0.9, matchCount / keywords.length * 2);
      scores.push({ topicId, confidence, matched: matchedKeywords });
    }
  }

  scores.sort((a, b) => b.confidence - a.confidence);
  return scores.slice(0, 3);
}

async function main() {
  const db = new Database(DB_PATH);

  // Get notes with file paths
  const notes = db.prepare(`
    SELECT n.id, n.title, n.file_path, w.folder_path as workspace_path
    FROM notes n
    JOIN workspaces w ON n.workspace_id = w.id
    WHERE n.is_deleted = 0
    LIMIT 50
  `).all() as { id: string; title: string; file_path: string; workspace_path: string }[];

  console.log('Found ' + notes.length + ' notes to classify\n');

  // Get topics
  const topics = db.prepare('SELECT id, name FROM topics').all() as { id: string; name: string }[];
  console.log('Available topics:', topics.map(t => t.id + ' (' + t.name + ')').join(', '), '\n');

  let classified = 0;
  let skipped = 0;

  for (const note of notes) {
    const fullPath = path.join(note.workspace_path, note.file_path);
    console.log('\n--- Note: ' + note.title + ' ---');
    console.log('File: ' + fullPath);

    if (!fs.existsSync(fullPath)) {
      console.log('  [File not found]');
      skipped++;
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    console.log('  Content length: ' + content.length + ' chars');
    console.log('  Preview: ' + content.substring(0, 100).replace(/\n/g, ' ') + '...');

    const matches = classifyText(content);

    if (matches.length === 0) {
      console.log('  [No keyword matches]');
      skipped++;
    } else {
      for (const m of matches) {
        console.log('  -> ' + m.topicId + ': ' + m.matched.join(', '));
      }
      console.log('  Classification: ' + matches.map(m => m.topicId + ' (' + (m.confidence * 100).toFixed(0) + '%)').join(', '));

      // Insert into note_topics
      const now = Date.now();
      for (const match of matches) {
        db.prepare(`
          INSERT OR REPLACE INTO note_topics (note_id, topic_id, confidence, is_manual, created_at)
          VALUES (?, ?, ?, 0, ?)
        `).run(note.id, match.topicId, match.confidence, now);
      }
      console.log('  [Saved to DB]');
      classified++;
    }
  }

  // Update note counts
  db.prepare(`
    UPDATE topics SET note_count = (
      SELECT COUNT(DISTINCT nt.note_id)
      FROM note_topics nt
      JOIN notes n ON nt.note_id = n.id
      WHERE nt.topic_id = topics.id AND n.is_deleted = 0
    )
  `).run();

  console.log('\n--- Summary ---');
  console.log('Classified: ' + classified);
  console.log('Skipped: ' + skipped);

  console.log('\n--- Final Topic Counts ---');
  const finalCounts = db.prepare('SELECT name, note_count FROM topics').all() as { name: string; note_count: number }[];
  for (const t of finalCounts) {
    console.log(t.name + ': ' + t.note_count + ' notes');
  }

  db.close();
}

main().catch(console.error);
