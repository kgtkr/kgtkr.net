{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    dream2nix.url = "github:nix-community/dream2nix";
    dream2nix.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
        "x86_64-darwin"
      ];
      perSystem =
        {
          self',
          pkgs,
          system,
          ...
        }:
        let
          lib = pkgs.lib;
          # TODO: .next/cache に書き込もうとしてエラーが出る
          website = inputs.dream2nix.lib.evalModules {
            packageSets.nixpkgs = pkgs;
            modules = [
              inputs.dream2nix.modules.dream2nix.nodejs-package-lock-v3
              inputs.dream2nix.modules.dream2nix.nodejs-granular-v3
              {
                name = "kgtkr.net";
                version = "0.1.0";
                mkDerivation = {
                  src = ./.;
                  preInstallPhases = lib.mkForce [ ];
                  installPhase = ''
                    runHook preInstall

                    mkdir -p $out/lib/kgtkr.net
                    cp -a .next/standalone/. $out/lib/kgtkr.net/
                    cp -a .next/static $out/lib/kgtkr.net/.next/static
                    cp -a public $out/lib/kgtkr.net/public
                    cp -a next.config.mjs $out/lib/kgtkr.net/next.config.mjs

                    mkdir -p $out/bin
                    makeWrapper ${pkgs.nodejs_24}/bin/node $out/bin/kgtkr.net \
                      --chdir $out/lib/kgtkr.net \
                      --add-flags $out/lib/kgtkr.net/server.js \
                      --set-default PORT 3000 \
                      --set-default NODE_ENV production

                    runHook postInstall
                  '';
                  meta = {
                    mainProgram = "kgtkr.net";
                  };
                };
                env = {
                  NEXT_TELEMETRY_DISABLED = "1";
                };
                deps =
                  { nixpkgs, ... }:
                  {
                    inherit (nixpkgs) fetchFromGitHub stdenv;
                    nodejs = nixpkgs.nodejs_24;
                  };
                nodejs-package-lock-v3 = {
                  packageLockFile = ./package-lock.json;
                };
              }
            ];
          };
        in
        {
          packages.default = website.config.public;

          devShells.default = pkgs.mkShell {
            buildInputs = [
              pkgs.nodejs_24
            ];
          };
          formatter = pkgs.nixfmt-tree;
        };
    };
}
