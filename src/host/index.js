/**
 * Host entry of the Cloudflare dashboard bundle.
 *
 * The Host half owns the Token and the outbound Cloudflare API calls. The
 * browser half only talks to the routes registered here, so no credential ever
 * reaches the page. `webServer` is a hard dependency; `credentials` is resolved
 * per request so a profile without a credential store still loads the plugin and
 * reports why saving is unavailable.
 */
import { registerRoutes } from './routes.js'

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.inject(['webServer'], (hostCtx) => {
    hostCtx.effect(
      () => registerRoutes({
        get: (name) => hostCtx.get(name),
        webServer: hostCtx.webServer,
      }),
      'cloudflare-dash: http routes',
    )
  })
}
