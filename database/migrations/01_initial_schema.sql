-- GIC Booth - Supabase Initial Schema Migration
-- Migration: 01_initial_schema.sql

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Booths Table (supports multi-booth installations)
CREATE TABLE IF NOT EXISTS public.booths (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT true,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default booth
INSERT INTO public.booths (id, name, location)
VALUES ('booth-01', 'GIC Booth Main', 'Kiosk 1')
ON CONFLICT (id) DO NOTHING;

-- 2. Sessions Table
CREATE TABLE IF NOT EXISTS public.sessions (
    id TEXT PRIMARY KEY,
    booth_id TEXT REFERENCES public.booths(id) ON DELETE SET NULL,
    layout_id TEXT NOT NULL DEFAULT 'classic-4',
    theme_id TEXT,
    capture_count INTEGER NOT NULL DEFAULT 0,
    downloaded BOOLEAN NOT NULL DEFAULT false,
    printed BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'Active', -- 'Active', 'Completed', 'Abandoned'
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_booth_id ON public.sessions(booth_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON public.sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);

-- 3. Analytics Events Table
CREATE TABLE IF NOT EXISTS public.events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booth_id TEXT REFERENCES public.booths(id) ON DELETE SET NULL,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_session_id ON public.events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON public.events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at DESC);

-- 4. Themes Table (Transparent PNG frames & color themes)
CREATE TABLE IF NOT EXISTS public.themes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Custom',
    layout_id TEXT NOT NULL DEFAULT 'classic-4',
    frame_url TEXT NOT NULL DEFAULT '',
    preview_url TEXT NOT NULL DEFAULT '',
    width INTEGER NOT NULL DEFAULT 600,
    height INTEGER NOT NULL DEFAULT 1800,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_themes_layout_id ON public.themes(layout_id);
CREATE INDEX IF NOT EXISTS idx_themes_active ON public.themes(active);

-- 5. Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    booth_id TEXT NOT NULL REFERENCES public.booths(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (booth_id, key)
);

-- 6. Storage Buckets for Themes
-- Run in Supabase SQL editor:
INSERT INTO storage.buckets (id, name, public)
VALUES ('gic-themes', 'gic-themes', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 7. Row Level Security (RLS)
ALTER TABLE public.booths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow public read for themes & settings (so kiosk can pull even when unauthenticated)
CREATE POLICY "Public read active themes" ON public.themes
    FOR SELECT USING (true);

CREATE POLICY "Public insert themes" ON public.themes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update themes" ON public.themes
    FOR UPDATE USING (true);

CREATE POLICY "Public read settings" ON public.settings
    FOR SELECT USING (true);

CREATE POLICY "Public upsert settings" ON public.settings
    FOR ALL USING (true);

-- Allow inserting analytics events & sessions from kiosk
CREATE POLICY "Public insert sessions" ON public.sessions
    FOR ALL USING (true);

CREATE POLICY "Public insert events" ON public.events
    FOR ALL USING (true);

CREATE POLICY "Public read booths" ON public.booths
    FOR SELECT USING (true);

-- Storage bucket access policy for gic-themes
CREATE POLICY "Public can view theme frames" ON storage.objects
    FOR SELECT USING (bucket_id = 'gic-themes');

CREATE POLICY "Public can upload theme frames" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'gic-themes');

CREATE POLICY "Public can update theme frames" ON storage.objects
    FOR UPDATE USING (bucket_id = 'gic-themes');
