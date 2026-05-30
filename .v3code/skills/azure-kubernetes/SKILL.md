---
name: azure-kubernetes
description: Azure Kubernetes Service (AKS) patterns and operations
keywords:
  - AKS
  - kubernetes
  - k8s
  - cluster
  - pod
  - deployment
  - service
  - ingress
  - helm
  - kubectl
alwaysApply: false
---

# Azure Kubernetes (AKS) Skill

## AKS Quick Start

```bash
# Create cluster
az aks create -g mygroup -n mycluster \
  --node-count 3 --node-vm-size Standard_B2s \
  --enable-managed-identity --generate-ssh-keys

# Get credentials
az aks get-credentials -g mygroup -n mycluster

# Verify
kubectl get nodes
```

## Essential kubectl Commands

```bash
# View resources
kubectl get pods                    # List pods
kubectl get svc                     # List services
kubectl get deployments             # List deployments
kubectl get all -n my-namespace     # All resources in namespace

# Debugging
kubectl describe pod <name>         # Detailed pod info
kubectl logs <pod> -f               # Stream logs
kubectl exec -it <pod> -- sh        # Shell into pod
kubectl top pods                    # Resource usage

# Apply changes
kubectl apply -f manifest.yaml      # Create/update resources
kubectl delete -f manifest.yaml     # Delete resources
kubectl rollout restart deployment/myapp  # Restart pods
```

## Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: app
        image: myregistry.azurecr.io/myapp:v1.0
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "128Mi"
            cpu: "250m"
          limits:
            memory: "256Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
```

## Common AKS Patterns

### Managed Identity for ACR
```bash
az aks update -g mygroup -n mycluster --attach-acr myregistry
```

### Horizontal Pod Autoscaler
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Secrets from Key Vault
```bash
# Install CSI driver
az aks enable-addons --addons azure-keyvault-secrets-provider \
  -g mygroup -n mycluster
```

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Pod stuck in Pending | `kubectl describe pod` → check events (resource limits, node capacity) |
| CrashLoopBackOff | `kubectl logs <pod> --previous` → check app startup errors |
| ImagePullBackOff | Check ACR access, image name/tag |
| Service unreachable | Check selector labels match, port mapping |
| OOMKilled | Increase memory limits |
