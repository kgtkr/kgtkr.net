{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
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
        {
          devShells.default = pkgs.mkShell {
            buildInputs = [
              pkgs.nodejs_22
            ];
          };
          formatter = pkgs.nixfmt-tree;
        };
    };
}
