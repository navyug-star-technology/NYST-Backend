const allowedKinds = new Set(["visitor", "question", "project"]);

function cleanText(value, field, maxLength, required = false) {
  if (typeof value !== "string") {
    if (required) throw Object.assign(new Error(`${field} is required.`), { status: 400 });
    return "";
  }
  const cleaned = value.trim();
  if (required && !cleaned) {
    throw Object.assign(new Error(`${field} is required.`), { status: 400 });
  }
  if (cleaned.length > maxLength) {
    throw Object.assign(new Error(`${field} must be ${maxLength} characters or fewer.`), {
      status: 400,
    });
  }
  return cleaned;
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeSubmission(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw Object.assign(new Error("Submission must be a JSON object."), { status: 400 });
  }
  if (!allowedKinds.has(body.kind)) {
    throw Object.assign(new Error("Submission kind is invalid."), { status: 400 });
  }

  let fields;
  if (body.kind === "visitor") {
    fields = {
      name: cleanText(body.name, "Name", 120, true),
      email: cleanText(body.email, "Email", 254, true),
    };
  } else if (body.kind === "question") {
    fields = {
      name: cleanText(body.name, "Name", 120, true),
      email: cleanText(body.email, "Email", 254, true),
      topic: cleanText(body.topic, "Topic", 160, true),
      question: cleanText(body.question, "Question", 5000, true),
    };
  } else {
    fields = {
      name: cleanText(body.name, "Name", 120, true),
      business: cleanText(body.business, "Business", 160),
      contact: cleanText(body.contact, "Email or phone", 254, true),
      service: cleanText(body.service, "Service", 160),
      description: cleanText(body.description, "Project description", 5000, true),
      budget: cleanText(body.budget, "Budget", 100),
    };
  }

  if ((body.kind === "visitor" || body.kind === "question") && !validEmail(fields.email)) {
    throw Object.assign(new Error("Enter a valid email address."), { status: 400 });
  }

  return {
    kind: body.kind,
    fields,
    source: cleanText(body.source, "Source", 200) || "website",
  };
}
