FROM prom/prometheus:latest

# Copy custom config
COPY prometheus.yml /etc/prometheus/prometheus.yml

# Expose port 9090
EXPOSE 9090

# Set default port for Railway
ENV PORT=9090

# Enable lifecycle API for config reloads
ENTRYPOINT [ "/bin/prometheus" ]
CMD ["--config.file=/etc/prometheus/prometheus.yml", \
     "--storage.tsdb.path=/prometheus", \
     "--web.console.libraries=/usr/share/prometheus/console_libraries", \
     "--web.console.templates=/usr/share/prometheus/consoles", \
     "--web.listen-address=0.0.0.0:9090", \
     "--web.enable-lifecycle"]
