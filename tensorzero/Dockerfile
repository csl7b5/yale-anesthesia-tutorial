# Extends the official TensorZero image and bakes in our config.
# The gateway binary reads the config from TENSORZERO_CONFIG_PATH
# (default: /app/config/tensorzero.toml).
FROM tensorzero/tensorzero:latest
COPY config/tensorzero.toml /app/config/tensorzero.toml
