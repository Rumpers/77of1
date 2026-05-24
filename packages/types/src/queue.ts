export interface GenerationJobPayload {
  jobId: string;
  creatorId: string;
  fanId: string;
  jobType: 'text' | 'voice' | 'video';
  prompt: string;
  consentGrantVersion: string;
}
