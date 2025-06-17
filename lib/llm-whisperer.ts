interface ParsedResume {
  name: string;
  email: string;
  phone?: string;
  summary?: string;
  skills: string[];
  experience: Array<{
    company: string;
    position: string;
    startDate: string;
    endDate?: string;
    description: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    graduationDate: string;
  }>;
  location?: string;
}

export async function parseResume(file: File): Promise<ParsedResume> {
  const formData = new FormData();
  formData.append('file', file);
  
  // Add processing options
  formData.append('processing_mode', 'ocr');
  formData.append('output_format', 'json');
  
  const response = await fetch('https://llmwhisperer.unstract.com/v1/extract', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LLM_WHISPERER_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Resume parsing failed: ${response.statusText}`);
  }

  const rawText = await response.text();
  
  // Use AI to structure the extracted text
  return structureResumeText(rawText);
}

async function structureResumeText(text: string): Promise<ParsedResume> {
  // This is a simplified version - in production, you'd use
  // more sophisticated parsing or OpenAI to structure the text
  
  const lines = text.split('\n').filter(line => line.trim());
  
  // Basic extraction patterns
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  
  const resume: ParsedResume = {
    name: lines[0] || 'Unknown',
    email: '',
    skills: [],
    experience: [],
    education: [],
  };
  
  // Extract email
  for (const line of lines) {
    const emailMatch = line.match(emailRegex);
    if (emailMatch) {
      resume.email = emailMatch[1];
      break;
    }
  }
  
  // Extract phone
  for (const line of lines) {
    const phoneMatch = line.match(phoneRegex);
    if (phoneMatch) {
      resume.phone = phoneMatch[0];
      break;
    }
  }
  
  // Extract sections (simplified)
  let currentSection = '';
  const sections: { [key: string]: string[] } = {};
  
  for (const line of lines) {
    const upperLine = line.toUpperCase();
    
    if (upperLine.includes('EXPERIENCE') || upperLine.includes('EMPLOYMENT')) {
      currentSection = 'experience';
      sections[currentSection] = [];
    } else if (upperLine.includes('EDUCATION')) {
      currentSection = 'education';
      sections[currentSection] = [];
    } else if (upperLine.includes('SKILLS')) {
      currentSection = 'skills';
      sections[currentSection] = [];
    } else if (upperLine.includes('SUMMARY') || upperLine.includes('OBJECTIVE')) {
      currentSection = 'summary';
      sections[currentSection] = [];
    } else if (currentSection && sections[currentSection]) {
      sections[currentSection].push(line);
    }
  }
  
  // Process skills
  if (sections.skills) {
    resume.skills = sections.skills
      .join(' ')
      .split(/[,;|]/) 
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  
  // Process summary
  if (sections.summary) {
    resume.summary = sections.summary.join(' ').trim();
  }
  
  // Note: In production, you'd parse experience and education
  // more carefully, possibly using OpenAI to structure the data
  
  return resume;
}

// Validate parsed resume data
export function validateParsedResume(resume: ParsedResume): string[] {
  const errors: string[] = [];
  
  if (!resume.name || resume.name === 'Unknown') {
    errors.push('Could not extract name from resume');
  }
  
  if (!resume.email) {
    errors.push('Could not extract email from resume');
  }
  
  if (resume.skills.length === 0) {
    errors.push('No skills found in resume');
  }
  
  if (resume.experience.length === 0) {
    errors.push('No work experience found in resume');
  }
  
  return errors;
}