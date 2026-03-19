-- CHG-29: 投稿/字幕驳回理由字段
ALTER TABLE video_sources ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(200);
ALTER TABLE subtitles ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(200);
