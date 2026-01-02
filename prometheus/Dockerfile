FROM prom/prometheus:latest

# Copy custom config
COPY prometheus.yml /etc/prometheus/prometheus.yml

# Expose port
EXPOSE 9090

# Enable lifecycle API for config reloads
CMD ["--config.file=/etc/prometheus/prometheus.yml", \
     "--storage.tsdb.path=/prometheus", \
     "--web.console.libraries=/usr/share/prometheus/console_libraries", \
     "--web.console.templates=/usr/share/prometheus/consoles", \
     "--web.enable-lifecycle"]
