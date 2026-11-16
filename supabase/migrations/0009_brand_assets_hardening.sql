-- ===========================================================================
-- 0009 — brand-assets bucket hardening: 2 MB cap + image-only MIME allowlist
-- Defense in depth behind the client-side SVG sanitizer (GeneralView).
-- ===========================================================================

update storage.buckets
   set file_size_limit = 2097152,
       allowed_mime_types = array['image/svg+xml', 'image/png', 'image/webp']
 where id = 'brand-assets';
