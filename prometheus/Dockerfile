FROM prom/prometheus:latest

# Copy custom config
COPY prometheus.yml /etc/prometheus/prometheus.yml

# Expose port
EXPOSE 9090

# Health check for Railway
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9090/-/healthy || exit 1

# Enable lifecycle API for config reloads
ENTRYPOINT [ "/bin/prometheus" ]
CMD ["--config.file=/etc/prometheus/prometheus.yml", \
     "--storage.tsdb.path=/prometheus", \
     "--web.console.libraries=/usr/share/prometheus/console_libraries", \
     "--web.console.templates=/usr/share/prometheus/consoles", \
     "--web.enable-lifecycle"]
