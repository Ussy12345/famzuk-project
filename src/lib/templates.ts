// Default chapter structures. Admins can later override via the chapter_templates table.
export type Tpl = { title: string; sections: string[] }
export function buildTemplate(type: string): Tpl[] {
  const sys = /system|software/i.test(type)
  return [
    { title: 'Introduction', sections: ['Background of the Study', 'Statement of the Problem', 'Aim of the Study', 'Objectives of the Study', 'Research Questions', 'Significance of the Study', 'Scope of the Study', 'Definition of Terms'] },
    { title: 'Literature Review', sections: ['Conceptual Review', 'Theoretical Review', 'Review of Related Studies', 'Research Gap', 'Summary'] },
    sys ? { title: 'System Analysis and Design', sections: ['Research Methodology', 'Analysis of the Existing System', 'Problems of the Existing System', 'Analysis of the Proposed System', 'System Architecture', 'Database Design'] }
        : { title: 'Research Methodology', sections: ['Research Design', 'Population of the Study', 'Sampling Technique', 'Instruments for Data Collection', 'Method of Data Analysis', 'Ethical Considerations'] },
    sys ? { title: 'Implementation and Testing', sections: ['Development Environment', 'Implementation', 'System Testing', 'Results and Discussion'] }
        : { title: 'Results and Discussion', sections: ['Data Presentation', 'Analysis of Findings', 'Discussion of Findings'] },
    { title: 'Summary, Conclusion and Recommendations', sections: ['Summary', 'Conclusion', 'Recommendations', 'Suggestions for Further Study'] },
  ]
}
