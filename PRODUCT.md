# Product

<!-- impeccable:product-schema 1 -->

## Platform

Web and Tauri 2 Windows desktop

## Stack

React, TypeScript, Vite, browser APIs, Tauri 2, Rust, and SQLite. Supabase and Vercel remain the cloud layer.

## Users

Customers use a self-service touchscreen booth to create Korean-style photo strips. Booth owners later manage themes, settings, and usage through a remote admin dashboard.

## Product Purpose

GIC Booth guides a customer from camera capture to a high-resolution downloadable photo strip with minimal interaction. Success means the full customer flow works reliably in a normal browser before hardware integration begins.

## Positioning

One shared web-first experience produces configurable 2 x 6 inch photo strips while remaining suitable for a Windows kiosk and future remote administration.

## Operating Context

The primary setting is a public touchscreen kiosk with a camera and printer. Customers stand in front of the camera, complete one short session, download or print, then leave the booth ready for the next customer.

## Capabilities and Constraints

- Phase 1 covers touch-to-start, 3-cut and 4-cut layouts, timer selection, camera capture, extra-photo selection, theme selection, a fast-looping Live Strip preview, 600 x 1800 strip rendering, 1200 x 1800 print composition, download, and automatic reset.
- Camera access uses `MediaDevices.getUserMedia` and requires browser permission.
- Core booth behavior must eventually work without Internet access.
- Source photos should not persist after a completed session by default.
- Phase 2 printing is printer-agnostic and uses the operating-system printer selector; local persistence, online administration, and cloud synchronization remain later work.
- The Phase 2 desktop shell builds as a Windows executable, stores event analytics in local SQLite, falls back to browser local storage on the web, and exposes a responsive local dashboard at `/admin`.
- The admin includes session history and a local-first transparent PNG design manager. Published designs are persisted, can be activated or deactivated, and appear in the matching customer layout without source edits.
- SQLite includes a synchronization queue table for the later cloud connection.
- Supabase authentication/storage/synchronization and Vercel deployment are not configured yet.
- Phase 3 QR delivery will open a Live Strip page with exactly two actions: image download and video download.
- Working product name `GIC Booth` is inferred from the project directory.
- No logo, brand palette, photography, or other approved brand assets were supplied.

## Evidence on Hand

The implementation brief is `C:\Users\byron.reyes\Downloads\digital-photobooth-plan-v2.md`. No production content, usage data, testimonials, or brand assets exist yet.

## Product Principles

- Make every customer action obvious at standing distance.
- Keep capture automatic after the customer chooses a timer.
- Render final output at print resolution, independent of preview size.
- Treat camera failures as recoverable states with clear next actions.
- Add cloud and desktop complexity only after the browser flow is proven.

## Accessibility & Inclusion

Use large touch targets, visible keyboard focus, strong contrast, clear camera-permission recovery, and reduced-motion support.
