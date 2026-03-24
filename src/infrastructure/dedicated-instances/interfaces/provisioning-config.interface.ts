export interface ProvisioningConfig {
  namespace: string;
  replicaCount: number;
  imageTag: string;
  environmentVariables: Record<string, string>;
  secrets: Record<string, string>;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  autoScaling: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
    targetCPUUtilization: number;
    targetMemoryUtilization: number;
  };
  healthCheck: {
    enabled: boolean;
    path: string;
    initialDelaySeconds: number;
    periodSeconds: number;
  };
  persistence: {
    enabled: boolean;
    storageClass: string;
    size: string;
  };
}

export interface K8sDeploymentResult {
  deploymentName: string;
  serviceName: string;
  ingressUrl: string;
  status: string;
  pods: Array<{
    name: string;
    status: string;
    ip: string;
  }>;
}
