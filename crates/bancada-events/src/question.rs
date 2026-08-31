/// A structured question the harness raised, with its options.
///
/// The shape is the harness's, normalised: a prompt, a short header, and
/// options each carrying a label, a description and a preview. It is
/// already structured in the log, so rendering it as cards is drawing
/// rather than parsing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Question {
    pub header: String,
    pub prompt: String,
    pub multi: bool,
    pub options: Vec<QuestionOption>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QuestionOption {
    pub label: String,
    pub description: String,
    pub preview: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_option_may_carry_no_preview() {
        let o = QuestionOption {
            label: "Keep it".into(),
            description: "why".into(),
            preview: None,
        };
        assert!(o.preview.is_none());
    }

    #[test]
    fn a_question_holds_every_option_it_was_given() {
        let q = Question {
            header: "Route".into(),
            prompt: "Which way?".into(),
            multi: false,
            options: vec![
                QuestionOption {
                    label: "a".into(),
                    description: "d".into(),
                    preview: None,
                },
                QuestionOption {
                    label: "b".into(),
                    description: "d".into(),
                    preview: Some("p".into()),
                },
            ],
        };
        assert_eq!(q.options.len(), 2);
    }
}
