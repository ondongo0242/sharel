import type { SubtitleCue, SubtitleTrack } from '@/types/media';
import { Platform } from 'react-native';
import { nativeFileExplorer } from '@/services/NativeFileExplorer';

export const parseSRT = (content: string): SubtitleCue[] => {
  const cues: SubtitleCue[] = [];
  const blocks = content.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;

    const id = lines[0].trim();
    const timeLine = lines[1];
    const timeMatch = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );

    if (!timeMatch) continue;

    const startTime =
      parseInt(timeMatch[1]) * 3600 +
      parseInt(timeMatch[2]) * 60 +
      parseInt(timeMatch[3]) +
      parseInt(timeMatch[4]) / 1000;

    const endTime =
      parseInt(timeMatch[5]) * 3600 +
      parseInt(timeMatch[6]) * 60 +
      parseInt(timeMatch[7]) +
      parseInt(timeMatch[8]) / 1000;

    const text = lines.slice(2).join('\n').trim();

    cues.push({ id, startTime, endTime, text });
  }

  return cues;
};

export const parseVTT = (content: string): SubtitleCue[] => {
  const cues: SubtitleCue[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }

  let cueId = 1;
  while (i < lines.length) {
    const timeLine = lines[i];
    const timeMatch = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/
    );

    if (timeMatch) {
      const startTime =
        parseInt(timeMatch[1]) * 3600 +
        parseInt(timeMatch[2]) * 60 +
        parseInt(timeMatch[3]) +
        parseInt(timeMatch[4]) / 1000;

      const endTime =
        parseInt(timeMatch[5]) * 3600 +
        parseInt(timeMatch[6]) * 60 +
        parseInt(timeMatch[7]) +
        parseInt(timeMatch[8]) / 1000;

      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
        textLines.push(lines[i].trim());
        i++;
      }

      cues.push({
        id: String(cueId++),
        startTime,
        endTime,
        text: textLines.join('\n'),
      });
    } else {
      i++;
    }
  }

  return cues;
};

export const parseASS = (content: string): SubtitleCue[] => {
  const cues: SubtitleCue[] = [];
  const lines = content.split('\n');
  let cueId = 1;

  for (const line of lines) {
    if (line.startsWith('Dialogue:')) {
      const parts = line.substring(9).split(',');
      if (parts.length < 10) continue;

      const startTimeStr = parts[1].trim();
      const endTimeStr = parts[2].trim();

      const parseASSTime = (timeStr: string): number => {
        const match = timeStr.match(/(\d+):(\d{2}):(\d{2})\.(\d{2})/);
        if (!match) return 0;
        return (
          parseInt(match[1]) * 3600 +
          parseInt(match[2]) * 60 +
          parseInt(match[3]) +
          parseInt(match[4]) / 100
        );
      };

      const startTime = parseASSTime(startTimeStr);
      const endTime = parseASSTime(endTimeStr);

      let text = parts.slice(9).join(',');
      text = text.replace(/\{[^}]*\}/g, '');
      text = text.replace(/\\N/g, '\n');
      text = text.trim();

      cues.push({
        id: String(cueId++),
        startTime,
        endTime,
        text,
      });
    }
  }

  return cues;
};

export const parseSubtitles = async (track: SubtitleTrack): Promise<SubtitleCue[]> => {
  try {
    let content: string;

    if (track.uri.startsWith('file://')) {
      if (Platform.OS === 'android' && nativeFileExplorer.isAvailable()) {
        content = await nativeFileExplorer.readFileAsString(track.uri);
      } else {
        const response = await fetch(track.uri);
        content = await response.text();
      }
    } else if (track.uri.startsWith('http')) {
      const response = await fetch(track.uri);
      content = await response.text();
    } else {
      content = track.uri;
    }

    switch (track.format) {
      case 'srt':
        return parseSRT(content);
      case 'vtt':
        return parseVTT(content);
      case 'ass':
        return parseASS(content);
      default:
        return parseSRT(content);
    }
  } catch (error) {
    console.error('Error parsing subtitles:', error);
    return [];
  }
};

export const getCurrentCue = (cues: SubtitleCue[], position: number): SubtitleCue | null => {
  for (const cue of cues) {
    if (position >= cue.startTime && position <= cue.endTime) {
      return cue;
    }
  }
  return null;
};

export const formatSubtitleText = (text: string): string => {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\{[^}]+\}/g, '')
    .trim();
};

export const detectSubtitleFormat = (filename: string): 'srt' | 'vtt' | 'ass' => {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  if (ext === '.vtt') return 'vtt';
  if (ext === '.ass' || ext === '.ssa') return 'ass';
  return 'srt';
};
