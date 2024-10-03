// api/github-commit.js
export default async function handler(req, res) {
  if (req.method === 'POST') {
      const commitData = req.body;

      // Validate if this is a push event, if not, exit
      if (!commitData.ref || !commitData.commits) {
          return res.status(400).json({ error: 'Not a valid push event' });
      }

      // Extract the necessary commit information and attempt to retrieve the email
      const commits = await Promise.all(
          commitData.commits.map(async (commit) => {
              // Fetch email via GitHub API if not present in payload
              let email = commit.author.email || null;
              if (!email) {
                  email = await getUserEmailFromGitHub(commit.author.name);
              }

              return {
                  message: commit.message,
                  author: commit.author.name,
                  email: email, // Add the email here
                  url: commit.url,
                  timestamp: commit.timestamp,
                  repository: commitData.repository.name, // Get the repository name
              };
          })
      );

      // Send the commits to Monday.com
      try {
          const mondayResult = await sendCommitsToMonday(commits);
          res.status(200).json({ success: true, data: mondayResult });
      } catch (error) {
          console.error('Error sending data to Monday.com:', error);
          res.status(500).json({ error: 'Failed to send data to Monday.com' });
      }
  } else {
      res.status(405).json({ message: 'Only POST requests are accepted' });
  }
}

// Function to send commits data to Monday.com
async function sendCommitsToMonday(commits) {
  const mondayApiUrl = 'https://api.monday.com/v2';
  const mondayApiKey = process.env.MONDAY_API_TOKEN;
  const boardId = process.env.MONDAY_BOARD_ID;

  const results = [];

  // Loop through each commit and send it as an item to the Monday.com board
  for (const commit of commits) {
      const formattedTimestamp = commit.timestamp.split('T')[0]; // Get only the date from timestamp

      const query = `
          mutation {
              create_item (
                  board_id: ${boardId},
                  item_name: "${commit.message}",
                  column_values: "{\\"text4__1\\": \\"${commit.author}\\", \\"text0__1\\": \\"${commit.email}\\", \\"text__1\\": \\"${commit.url}\\", \\"date__1\\": \\"${formattedTimestamp}\\", \\"text8__1\\": \\"${commit.repository}\\"}"
              ) {
                  id
              }
          }
      `;

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
  }

  return results;
}

// Helper function to get user's email from GitHub
async function getUserEmailFromGitHub(username) {
  const githubApiUrl = `https://api.github.com/users/${username}`;
  
  try {
      const response = await fetch(githubApiUrl, {
          headers: {
              Authorization: `Bearer ${process.env.GITHUB_ACCESS_TOKEN}`, // Make sure you have set this environment variable
          },
      });

      if (!response.ok) {
          console.error(`GitHub API request failed for user ${username}`);
          return null;
      }

      const data = await response.json();
      return data.email || "email not available"; // Return null if email is not available or private
  } catch (error) {
      console.error(`Error fetching email for GitHub user ${username}:`, error);
      return null;
  }
}
