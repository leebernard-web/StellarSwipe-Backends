import { Logger } from '@nestjs/common';
import { ProvisioningConfig, K8sDeploymentResult } from '../interfaces/provisioning-config.interface';
import { InstanceSpec } from '../interfaces/instance-spec.interface';

export class K8sProvisioner {
  private readonly logger = new Logger(K8sProvisioner.name);

  async provisionInstance(
    instanceId: string,
    instanceName: string,
    spec: InstanceSpec,
    config: ProvisioningConfig,
  ): Promise<K8sDeploymentResult> {
    this.logger.log(`Provisioning K8s instance ${instanceId} with name ${instanceName}`);

    const deploymentName = `instance-${instanceId}`;
    const serviceName = `service-${instanceId}`;

    const deployment = this.createDeploymentManifest(
      deploymentName,
      instanceName,
      spec,
      config,
    );

    const service = this.createServiceManifest(serviceName, deploymentName, config);

    const ingress = this.createIngressManifest(deploymentName, serviceName, config);

    this.logger.log(`Deploying instance ${instanceId} to namespace ${config.namespace}`);

    const pods = await this.deployResources(
      config.namespace,
      deployment,
      service,
      ingress,
    );

    const ingressUrl = `https://${instanceName}.dedicated.stellarswipe.io`;

    return {
      deploymentName,
      serviceName,
      ingressUrl,
      status: 'provisioning',
      pods,
    };
  }

  async terminateInstance(
    namespace: string,
    deploymentName: string,
    serviceName: string,
  ): Promise<void> {
    this.logger.log(`Terminating instance ${deploymentName} in namespace ${namespace}`);
    await this.deleteResources(namespace, deploymentName, serviceName);
  }

  async scaleInstance(
    namespace: string,
    deploymentName: string,
    replicaCount: number,
  ): Promise<void> {
    this.logger.log(`Scaling deployment ${deploymentName} to ${replicaCount} replicas`);
    await this.updateReplicaCount(namespace, deploymentName, replicaCount);
  }

  async getInstanceStatus(
    namespace: string,
    deploymentName: string,
  ): Promise<{ status: string; ready: number; total: number }> {
    this.logger.log(`Getting status for deployment ${deploymentName}`);
    return this.fetchDeploymentStatus(namespace, deploymentName);
  }

  private createDeploymentManifest(
    deploymentName: string,
    instanceName: string,
    spec: InstanceSpec,
    config: ProvisioningConfig,
  ): any {
    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: deploymentName,
        namespace: config.namespace,
        labels: {
          app: instanceName,
          ...config.labels,
        },
        annotations: config.annotations,
      },
      spec: {
        replicas: config.replicaCount,
        selector: {
          matchLabels: {
            app: instanceName,
          },
        },
        template: {
          metadata: {
            labels: {
              app: instanceName,
            },
          },
          spec: {
            containers: [
              {
                name: 'app',
                image: `stellarswipe/backend:${config.imageTag}`,
                resources: {
                  requests: {
                    cpu: `${spec.cpu * 0.5}`,
                    memory: `${spec.memory * 0.5}Gi`,
                  },
                  limits: {
                    cpu: `${spec.cpu}`,
                    memory: `${spec.memory}Gi`,
                  },
                },
                env: Object.entries(config.environmentVariables).map(([key, value]) => ({
                  name: key,
                  value,
                })),
                ports: [
                  {
                    containerPort: 3000,
                    protocol: 'TCP',
                  },
                ],
                ...(config.healthCheck.enabled && {
                  livenessProbe: {
                    httpGet: {
                      path: config.healthCheck.path,
                      port: 3000,
                    },
                    initialDelaySeconds: config.healthCheck.initialDelaySeconds,
                    periodSeconds: config.healthCheck.periodSeconds,
                  },
                  readinessProbe: {
                    httpGet: {
                      path: config.healthCheck.path,
                      port: 3000,
                    },
                    initialDelaySeconds: config.healthCheck.initialDelaySeconds,
                    periodSeconds: config.healthCheck.periodSeconds,
                  },
                }),
              },
            ],
          },
        },
      },
    };
  }

  private createServiceManifest(
    serviceName: string,
    deploymentName: string,
    config: ProvisioningConfig,
  ): any {
    return {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: serviceName,
        namespace: config.namespace,
      },
      spec: {
        selector: {
          app: deploymentName,
        },
        ports: [
          {
            protocol: 'TCP',
            port: 80,
            targetPort: 3000,
          },
        ],
        type: 'ClusterIP',
      },
    };
  }

  private createIngressManifest(
    deploymentName: string,
    serviceName: string,
    config: ProvisioningConfig,
  ): any {
    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: `${deploymentName}-ingress`,
        namespace: config.namespace,
        annotations: {
          'kubernetes.io/ingress.class': 'nginx',
          'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
        },
      },
      spec: {
        tls: [
          {
            hosts: [`${deploymentName}.dedicated.stellarswipe.io`],
            secretName: `${deploymentName}-tls`,
          },
        ],
        rules: [
          {
            host: `${deploymentName}.dedicated.stellarswipe.io`,
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: serviceName,
                      port: {
                        number: 80,
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    };
  }

  private async deployResources(
    namespace: string,
    deployment: any,
    service: any,
    ingress: any,
  ): Promise<Array<{ name: string; status: string; ip: string }>> {
    this.logger.log(`Simulating K8s resource deployment to namespace ${namespace}`);
    return [
      {
        name: `${deployment.metadata.name}-pod-1`,
        status: 'Running',
        ip: '10.0.0.1',
      },
    ];
  }

  private async deleteResources(
    namespace: string,
    deploymentName: string,
    serviceName: string,
  ): Promise<void> {
    this.logger.log(`Simulating deletion of K8s resources in namespace ${namespace}`);
  }

  private async updateReplicaCount(
    namespace: string,
    deploymentName: string,
    replicaCount: number,
  ): Promise<void> {
    this.logger.log(`Simulating replica count update for ${deploymentName} to ${replicaCount}`);
  }

  private async fetchDeploymentStatus(
    namespace: string,
    deploymentName: string,
  ): Promise<{ status: string; ready: number; total: number }> {
    this.logger.log(`Fetching status for deployment ${deploymentName}`);
    return {
      status: 'active',
      ready: 1,
      total: 1,
    };
  }
}
