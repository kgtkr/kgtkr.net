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
      imports = [
        ./image.nix
      ];
      perSystem =
        {
          pkgs,
          ...
        }:
        let
          lib = pkgs.lib;
          nodejs = pkgs.nodejs_24;
          kgtkrnet = inputs.dream2nix.lib.evalModules {
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
                    makeWrapper ${nodejs}/bin/node $out/bin/kgtkr.net \
                      --chdir $out/lib/kgtkr.net \
                      --add-flags $out/lib/kgtkr.net/server.js \
                      --set-default PORT 3000 \
                      --set-default NODE_ENV production

                    runHook postInstall
                  '';
                  passthru = {
                    meta = {
                      mainProgram = "kgtkr.net";
                    };
                  };
                };
                env = {
                  NEXT_TELEMETRY_DISABLED = "1";
                };
                deps =
                  { nixpkgs, ... }:
                  {
                    inherit (nixpkgs) fetchFromGitHub stdenv;
                    inherit nodejs;
                  };
                nodejs-package-lock-v3 = {
                  packageLockFile = ./package-lock.json;
                };
              }
            ];
          };
        in
        {
          packages = {
            inherit kgtkrnet;
            default = kgtkrnet;
          };

          devShells.default = pkgs.mkShell {
            buildInputs = [
              nodejs
              pkgs.skopeo
              pkgs.manifest-tool
            ];
          };
          formatter = pkgs.nixfmt-tree;
        };
    };
}
