import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const commitData = req.body;

    // Validate if this is a push event, if not, exit
    if (!commitData.ref || !commitData.commits) {
      return res.status(400).json({ error: 'Not a valid push event' });
    }

    try {
      // Extract the necessary commit information, filter out Devtools-related commits, and calculate lines of code
      const commits = await Promise.all(
        commitData.commits
          .filter(commit => commit.author.username !== 'Devtools')
          .map(async commit => ({
            message: commit.message,
            username: commit.author.username || commit.author.name,
            author: commit.author.name,
            url: commit.url,
            timestamp: commit.timestamp,
            repository: commitData.repository.name,
            linesOfCode: await calculatedLines(commit),
            copilotUsed: commit.message.includes("[Copilot]")
          }))
      );

      // If no commits remain after filtering, skip sending to Monday.com
      if (commits.length === 0) {
        return res.status(200).json({ message: 'No valid commits to process' });
      }

      // Send the commits to Monday.com
      const mondayResult = await sendCommitsToMonday(commits);
      res.status(200).json({ success: true, data: mondayResult });

    } catch (error) {
      console.error('Error processing webhook data:', error);
      res.status(500).json({ error: 'Failed to process data' });
    }
  } else {
    res.status(405).json({ message: 'Only POST requests are accepted' });
  }
}

// Function to calculate lines of code for a given commits
async function calculatedLines(commit) {
  const githubApiUrl = `${commit.url}`;
  const githubToken = process.env.GITHUB_TOKEN; // Ensure you have set this token in your environment variables

  try {
    const response = await fetch(githubApiUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API responded with status: ${response.status}`);
    }

    const commitData = await response.json();

    // Calculate lines of code added (you can also consider deletions or changes as needed)
    let linesOfCode = 0;
    commitData.files.forEach(file => {
      linesOfCode += file.additions; // Count added lines
    });

    return linesOfCode;

  } catch (error) {
    console.error('Error fetching commit data from GitHub:', error);
    return 0; // Return 0 if there was an error fetching data
  }
}

// Function to send commits data to Monday.com
async function sendCommitsToMonday(commits) {
  const mondayApiUrl = 'https://api.monday.com/v2';
  const mondayApiKey = process.env.MONDAY_API_TOKEN;
  const boardId = process.env.MONDAY_BOARD_ID;

  const results = [];

  for (const commit of commits) {
    const formattedTimestamp = commit.timestamp.split('T')[0];

    const query = `
      mutation {
        create_item (
          board_id: ${boardId},
          item_name: "${commit.message}",
          column_values: "{\\"text4__1\\": \\"${commit.author}\\", \\"text6__1\\": \\"${commit.username}\\", \\"text__1\\": \\"${commit.url}\\", \\"date__1\\": \\"${formattedTimestamp}\\", \\"text8__1\\": \\"${commit.repository}\\", \\"text10__1\\": \\"${commit.copilotUsed ? 'Yes' : 'No'}\\", \\"text80__1\\": \\"${commit.linesOfCode}\\"}"
        ) {
          id
        }
      }
    `;

    // Send the request to the Monday.com APIs
    const response = await fetch(mondayApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mondayApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

      const result = await response.json();
      results.push(result);

    } catch (error) {
      console.error('Error sending data to Monday.com:', error);
    }
  }

  return results;
}
