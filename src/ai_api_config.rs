//! AI API配置模块
//!
//! 集中管理DashScope API请求配置，方便调试和切换不同的API端点

use serde::{Deserialize, Serialize};

/// AI API配置
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AiApiConfig {
    /// API服务器域名
    pub server: String,
    /// API端口
    pub port: u16,
    /// API路径
    pub path: String,
    /// HTTP方法
    pub method: String,
    /// 请求体格式
    pub body_format: BodyFormat,
    /// 模型名称
    pub model: String,
    /// 自定义Headers
    pub headers: Vec<(String, String)>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub enum BodyFormat {
    /// DashScope text-generation格式
    /// POST /api/v1/services/aigc/text-generation/generation
    TextGeneration,
    /// OpenAI兼容格式 (ChatCompletions)
    /// POST /chat/completions
    ChatCompletions,
    /// 简单GET请求
    Get,
}

impl Default for AiApiConfig {
    fn default() -> Self {
        Self {
            server: "dashscope.aliyuncs.com".to_string(),
            port: 443,
            // 默认使用 compatible-mode (OpenAI兼容格式，更稳定)
            path: "/compatible-mode/v1/chat/completions".to_string(),
            method: "POST".to_string(),
            body_format: BodyFormat::ChatCompletions,
            model: "qwen-plus".to_string(),
            headers: vec![
                ("Accept".to_string(), "application/json".to_string()),
                ("Connection".to_string(), "close".to_string()),
            ],
        }
    }
}

impl AiApiConfig {
    /// 从环境变量加载配置
    pub fn from_env() -> Self {
        let mut config = Self::default();

        if let Ok(server) = std::env::var("TLSN_AI_SERVER") {
            config.server = server;
        }
        if let Ok(port) = std::env::var("TLSN_AI_PORT") {
            config.port = port.parse().unwrap_or(443);
        }
        if let Ok(path) = std::env::var("TLSN_AI_PATH") {
            config.path = path;
        }
        if let Ok(method) = std::env::var("TLSN_AI_METHOD") {
            config.method = method;
        }
        if let Ok(model) = std::env::var("DASHSCOPE_MODEL") {
            config.model = model;
        }
        if let Ok(format) = std::env::var("TLSN_AI_BODY_FORMAT") {
            config.body_format = match format.as_str() {
                "chat" => BodyFormat::ChatCompletions,
                "get" => BodyFormat::Get,
                _ => BodyFormat::TextGeneration,
            };
        }

        config
    }

    /// 构建请求体JSON
    pub fn build_request_body(&self, prompt: &str) -> String {
        match self.body_format {
            BodyFormat::TextGeneration => {
                serde_json::json!({
                    "model": self.model,
                    "input": {
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a helpful assistant."
                            },
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ]
                    },
                    "parameters": {
                        "result_format": "message"
                    }
                }).to_string()
            }
            BodyFormat::ChatCompletions => {
                serde_json::json!({
                    "model": self.model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a helpful assistant."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": 0.7
                }).to_string()
            }
            BodyFormat::Get => {
                String::new()
            }
        }
    }

    /// 获取Headers列表
    pub fn get_headers(&self, api_key: &str, content_length: usize) -> Vec<(&str, String)> {
        let mut headers = vec![
            ("Host", self.server.clone()),
            ("Content-Type", "application/json".to_string()),
            ("Content-Length", content_length.to_string()),
            ("Authorization", format!("Bearer {}", api_key)),
            ("Accept", "application/json".to_string()),
            ("Connection", "close".to_string()),
        ];

        // 添加自定义headers
        for (key, value) in &self.headers {
            headers.push((key.as_str(), value.clone()));
        }

        headers
    }
}

/// 预定义的API配置
pub mod presets {
    use super::*;

    /// DashScope text-generation (当前使用)
    pub fn dashscope_text_generation() -> AiApiConfig {
        AiApiConfig {
            server: "dashscope.aliyuncs.com".to_string(),
            port: 443,
            path: "/api/v1/services/aigc/text-generation/generation".to_string(),
            method: "POST".to_string(),
            body_format: BodyFormat::TextGeneration,
            model: "qwen-plus".to_string(),
            headers: vec![
                ("Accept".to_string(), "application/json".to_string()),
                ("Connection".to_string(), "close".to_string()),
            ],
        }
    }

    /// DashScope compatible-mode ChatCompletions
    pub fn dashscope_chat_completions() -> AiApiConfig {
        AiApiConfig {
            server: "dashscope.aliyuncs.com".to_string(),
            port: 443,
            path: "/compatible-mode/v1/chat/completions".to_string(),
            method: "POST".to_string(),
            body_format: BodyFormat::ChatCompletions,
            model: "qwen-plus".to_string(),
            headers: vec![
                ("Accept".to_string(), "application/json".to_string()),
                ("Connection".to_string(), "close".to_string()),
            ],
        }
    }

    /// DashScope /api/v1/models (GET)
    pub fn dashscope_models() -> AiApiConfig {
        AiApiConfig {
            server: "dashscope.aliyuncs.com".to_string(),
            port: 443,
            path: "/api/v1/models".to_string(),
            method: "GET".to_string(),
            body_format: BodyFormat::Get,
            model: "".to_string(),
            headers: vec![
                ("Accept".to_string(), "application/json".to_string()),
                ("Connection".to_string(), "close".to_string()),
            ],
        }
    }
}