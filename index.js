/**
 * Host half of the Cloudflare dashboard bundle.
 *
 * The plugin owns one exact HTTP surface under `/cloudflare-dash/api/v1` that
 * the browser half calls with same-origin `fetch`. The Cloudflare Token never
 * leaves the Host: the browser only receives configured state and a mask.
 */
export { apply } from './src/host/index.js'
