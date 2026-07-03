-- Migration 009: Add screening questions to applications
-- These are collected on the careers page application form

alter table applications
  add column if not exists work_authorized boolean,
  add column if not exists salary_expectations text;
