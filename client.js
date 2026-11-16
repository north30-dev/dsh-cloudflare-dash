/**
 * Client half of the Cloudflare dashboard bundle.
 *
 * The Web loader resolves a lazy factory whose id equals the package name.
 * This scaffold registers no slot yet: the dashboard UI, its slot choice, and
 * the owning Client package to inject belong in `src/client/` once designed.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-cloudflare-dash',
  factory() {
    return {
      apply() {},
    };
  },
});
