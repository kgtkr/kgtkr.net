{ lib, ... }:
{
  perSystem =
    { self', pkgs, ... }:
    let
      args = {
        name = "kgtkr.net";
        tag = "latest";
        contents = [
          pkgs.cacert
        ];
        fakeRootCommands = ''
          mkdir -p tmp
          chmod 1777 tmp
        '';
        config = {
          Entrypoint = [ (lib.getExe self'.packages.kgtkrnet) ];
          Env = [
            "PORT=3000"
            "NODE_ENV=production"
            "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
          ];
          ExposedPorts = {
            "3000/tcp" = { };
          };
          User = "65534:65534";
          WorkingDir = "/";
        };
      };
    in
    {
      packages = {
        image = pkgs.dockerTools.buildLayeredImage args;
      };
      apps = {
        streamImage = {
          type = "app";
          program = "${pkgs.dockerTools.streamLayeredImage args}";
        };
      };
    };
}
