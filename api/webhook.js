const fetch = require('node-fetch');

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const commitData = req.body;

    // Validate if this is a push event, if not, exit
    if (!commitData.ref || !commitData.commits) {
      return res.status(400).json({ error: 'Not a valid push event' });
    }

    // Extract the necessary commit information and filter out Devtools-related commitss
    const commits = commitData.commits
      .filter(commit => commit.author.username !== 'Devtools') // Filter commits from Devtools repo
      .map(commit => ({
        sha: commit.id, // Commit SHA to fetch LOC details
        message: commit.message,
        username: commit.author.username || commit.author.name,
        author: commit.author.name,
        url: commit.url,
        timestamp: commit.timestamp,
        repository: commitData.repository.name, // Get the repository name
      }));

    // If no commits remain after filtering, skip sending to Monday.com
    if (commits.length === 0) {
      return res.status(200).json({ message: 'No valid commits to process' });
    }

    // Fetch LOC for each commit and prepare data for Monday.com
    try {
      const commitsWithLoc = await Promise.all(
        commits.map(async commit => {
          const loc = await getLinesOfCode(commitData.repository.owner.name, commitData.repository.name, commit.sha);
          return { ...commit, loc };
        })
      );

      const mondayResult = await sendCommitsToMonday(commitsWithLoc);
      res.status(200).json({ success: true, data: mondayResult });
    } catch (error) {
      console.error('Error processing commits:', error);
      res.status(500).json({ error: 'Failed to process commits' });
    }
  } else {
    res.status(405).json({ message: 'Only POST requests are accepted' });
  }
}

// Function to calculate LOC by fetching commit diff data
async function getLinesOfCode(owner, repo, sha) {
  const githubToken = process.env.GITHUB_TOKEN;
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`Failed to fetch commit data for ${sha}`);
    return 0;
  }

  const data = await response.json();
  const additions = data.stats.additions || 0;
  const deletions = data.stats.deletions || 0;
  const loc = additions + deletions;

  return loc;
}

// Function to send commits data to Monday.com
async function sendCommitsToMonday(commits) {
  const mondayApiUrl = 'https://api.monday.com/v2';
  const mondayApiKey = process.env.MONDAY_API_TOKEN;
  const boardId = process.env.MONDAY_BOARD_ID;

  const results = [];

  // Loop through each commit and send it as an item to the Monday.com board
  for (const commit of commits) {
    // Format timestamp to only include date (e.g., 2023-10-03)
    const formattedTimestamp = commit.timestamp.split('T')[0];

    // GraphQL mutation query to create an item on the Monday.com board
    const query = `
      mutation {
        create_item (
          board_id: ${boardId},
          item_name: "${commit.message}",
          column_values: "{\\"text4__1\\": \\"${commit.author}\\", \\"text6__1\\": \\"${commit.username}\\", \\"text__1\\": \\"${commit.url}\\", \\"date__1\\": \\"${formattedTimestamp}\\", \\"text8__1\\": \\"${commit.repository}\\", \\"text_1__1\\": \\"${commit.loc}\\"}"
        ) {
          id
        }
      }
    `;

    // Send the request to the Monday.com API
    const response = await fetch(mondayApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mondayApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    // Handle the API response and store the result
    const result = await response.json();
    results.push(result);
  }

  return results;
}
