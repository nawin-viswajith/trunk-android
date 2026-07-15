export interface HfModelSummary {
  repo_id: string;
  url: string;
  downloads: number;
  likes: number;
  pipeline_tag: string | null;
  library_name: string | null;
  params: string | null;
  tags: string[];
}
