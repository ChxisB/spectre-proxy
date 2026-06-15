#!/bin/bash
# Docker helper script for Spectre Proxy

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

case "${1:-help}" in
  up|start)
    echo "Starting Spectre Proxy services..."
    docker compose -f "$COMPOSE_FILE" up -d
    echo ""
    echo "Services started:"
    echo "  Dashboard: http://localhost:3000"
    echo "  Proxy API: http://localhost:8082"
    echo "  Health:    curl http://localhost:8082/health"
    ;;
  down|stop)
    echo "Stopping Spectre Proxy services..."
    docker compose -f "$COMPOSE_FILE" down
    ;;
  restart)
    echo "Restarting Spectre Proxy services..."
    docker compose -f "$COMPOSE_FILE" restart
    ;;
  logs)
    docker compose -f "$COMPOSE_FILE" logs -f "${2:-}"
    ;;
  build)
    echo "Building Docker images..."
    docker compose -f "$COMPOSE_FILE" build
    ;;
  status)
    docker compose -f "$COMPOSE_FILE" ps
    ;;
  help|*)
    echo "Spectre Proxy Docker Helper"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  up|start    Start services in background"
    echo "  down|stop   Stop all services"
    echo "  restart     Restart all services"
    echo "  logs [svc]  View logs (optionally for specific service)"
    echo "  build       Build Docker images"
    echo "  status      Show service status"
    echo "  help        Show this help message"
    ;;
esac
