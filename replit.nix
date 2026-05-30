{ pkgs }: {
  # The nodejs-24 module in .replit provides Node.js and pnpm.
  # This nix file adds openssl (required by Supabase client's TLS bindings)
  # and any other system deps not covered by the module.
  deps = [
    pkgs.run
    pkgs.openssl
  ];
}
