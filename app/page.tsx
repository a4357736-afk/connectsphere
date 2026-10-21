"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Post = {
  id: string;
  username: string;
  avatar: string;
  location: string;
  image: string;
  caption: string;
  likes: number;
};

const samplePosts: Post[] = [];

export default function HomePage() {
  const router = useRouter();

  // Authentication state
  const [userEmail, setUserEmail] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // Homepage state
  const [posts, setPosts] = useState<Post[]>(samplePosts);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [postsLoading, setPostsLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [postError, setPostError] = useState("");
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [caption, setCaption] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState("Home");

  // Check the current Supabase session and listen for sign-out.
  useEffect(() => {
    let active = true;

    async function checkUser() {
      try {
        const { data, error } = await supabase.auth.getUser();

        if (!active) return;

        if (error || !data.user) {
          setAuthLoading(false);
          router.replace("/auth");
          return;
        }

        setUserEmail(data.user.email ?? "");
        setCurrentUserId(data.user.id);
        setAuthLoading(false);
      } catch {
        if (active) {
          setAuthLoading(false);
          router.replace("/auth");
        }
      }
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "SIGNED_OUT") {
        setUserEmail("");
        setCurrentUserId("");
        router.replace("/auth");
        return;
      }

      if (session?.user) {
        setUserEmail(session.user.email ?? "");
        setCurrentUserId(session.user.id);
        setAuthLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // Log out
  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        alert(`Logout failed: ${error.message}`);
        setLoggingOut(false);
        return;
      }

      router.replace("/auth");
    } catch {
      alert("Something went wrong while logging out.");
      setLoggingOut(false);
    }
  }

  // Load posts saved in Supabase.
  async function loadPosts() {
    setPostsLoading(true);
    setPostError("");

    const { data, error } = await supabase
      .from("posts")
      .select("id, user_id, image_url, caption, created_at, profiles!posts_user_id_fkey(username, full_name, avatar_url)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load posts:", error.message);
      setPostError(`Could not load posts: ${error.message}`);
      setPostsLoading(false);
      return;
    }

    const mappedPosts: Post[] = (data ?? []).map((row: any) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const username = profile?.username || "connectsphere_user";
      return {
        id: String(row.id),
        username,
        avatar: (username[0] || "U").toUpperCase(),
        location: "ConnectSphere",
        image: row.image_url,
        caption: row.caption || "",
        likes: 0,
      };
    });

    setPosts(mappedPosts);
    setPostsLoading(false);
  }

  useEffect(() => {
    if (currentUserId) void loadPosts();
  }, [currentUserId]);

  // Likes are currently local to this browser; persistent likes can be added next.
  function toggleLike(id: string) {
    const alreadyLiked = likedPosts.includes(id);
    setLikedPosts((current) =>
      alreadyLiked ? current.filter((postId) => postId !== id) : [...current, id]
    );
    setPosts((current) =>
      current.map((post) =>
        post.id === id
          ? { ...post, likes: Math.max(0, post.likes + (alreadyLiked ? -1 : 1)) }
          : post
      )
    );
  }

  // Upload an image and save the post in Supabase.
  async function createPost() {
    if (!caption.trim() || !selectedImage || !currentUserId || publishing) {
      setPostError("Choose an image and enter a caption before publishing.");
      return;
    }

    setPublishing(true);
    setPostError("");

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("id", currentUserId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        throw new Error("Your profile is missing. Please create your profile in Supabase before posting.");
      }

      const fileExtension = selectedImage.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeExtension = /^[a-z0-9]+$/.test(fileExtension) ? fileExtension : "jpg";
      const filePath = `${currentUserId}/${crypto.randomUUID()}.${safeExtension}`;

      const { error: uploadError } = await supabase.storage
        .from("post")
        .upload(filePath, selectedImage, {
          cacheControl: "3600",
          upsert: false,
          contentType: selectedImage.type || "image/jpeg",
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("post")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase.from("posts").insert({
        user_id: currentUserId,
        image_url: publicUrlData.publicUrl,
        caption: caption.trim(),
      });

      if (insertError) throw insertError;

      setCaption("");
      setSelectedImage(null);
      setShowCreate(false);
      await loadPosts();
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred.";
      setPostError(message);
    } finally {
      setPublishing(false);
    }
  }

  const visiblePosts = posts.filter((post) =>
    post.username.toLowerCase().includes(search.toLowerCase())
  );

  const navItems = [
    { label: "Home", icon: "⌂" },
    { label: "Search", icon: "⌕" },
    { label: "Explore", icon: "▦" },
    { label: "Messages", icon: "✉" },
    { label: "Notifications", icon: "♡" },
    { label: "Create", icon: "+" },
    { label: "Profile", icon: "◉" },
  ];

  // Do not show the feed until authentication has been checked.
  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
          <p className="text-sm text-gray-600">
            Checking your ConnectSphere session...
          </p>
        </div>
      </main>
    );
  }

  // A logged-out user is being redirected to /auth.
  if (!userEmail) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <p className="text-gray-600">Redirecting to login...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafafa] pb-20 text-gray-900 lg:pb-0">
      {/* Top navigation */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
          <a href="/" className="text-2xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
              Connect
            </span>
            Sphere<span className="text-purple-600">.</span>
          </a>

          <div className="hidden w-72 md:block">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search people..."
              className="w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            + Create post
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 md:px-8 lg:grid-cols-[220px_minmax(0,600px)_280px]">
        {/* Left sidebar */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  setActiveTab(item.label);

                  if (item.label === "Create") {
                    setShowCreate(true);
                  }

                  if (item.label === "Search") {
                    document.querySelector("input")?.focus();
                  }
                }}
                className={`flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition ${
                  activeTab === item.label
                    ? "bg-purple-50 font-bold text-purple-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span className="w-7 text-2xl">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main feed */}
        <section className="min-w-0">
          {/* Discover people / stories */}
          <div className="mb-7 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold">Discover people</h2>
              <span className="text-xs text-gray-400">
                YOUR COMMUNITY
              </span>
            </div>

            <div className="flex gap-5 overflow-x-auto pb-1">
              {[
                ["M", "maya", "Maya"],
                ["R", "rohan", "Rohan"],
                ["S", "sarah", "Sarah"],
                ["A", "alex", "Alex"],
                ["J", "jay", "Jay"],
              ].map(([letter, id, name], index) => (
                <button
                  key={id}
                  className="flex min-w-[65px] flex-col items-center gap-2"
                  onClick={() => setActiveTab("Profile")}
                >
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${
                      index % 2 === 0
                        ? "from-pink-400 to-purple-600"
                        : "from-orange-300 to-pink-500"
                    } p-[2px]`}
                  >
                    <span className="flex h-full w-full items-center justify-center rounded-full border-2 border-white bg-white font-bold">
                      {letter}
                    </span>
                  </span>

                  <span className="text-xs text-gray-600">{name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Feed heading */}
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold">Your feed</h2>
            <span className="text-xs text-gray-500">
              {visiblePosts.length} posts
            </span>
          </div>

          {/* Posts */}
          <div className="space-y-7">
            {postsLoading && (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                Loading posts from Supabase...
              </div>
            )}
            {postError && !showCreate && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {postError}
              </div>
            )}
            {!postsLoading && !postError && visiblePosts.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
                <p className="font-semibold">No posts yet</p>
                <p className="mt-2 text-sm text-gray-500">Be the first to share a photo with your community.</p>
              </div>
            )}
            {visiblePosts.map((post) => {
              const liked = likedPosts.includes(post.id);

              return (
                <article
                  key={post.id}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-600 font-bold text-white">
                        {post.avatar}
                      </span>

                      <div>
                        <p className="text-sm font-bold">
                          {post.username}
                        </p>
                        <p className="text-xs text-gray-500">
                          {post.location}
                        </p>
                      </div>
                    </div>

                    <button
                      aria-label="More post options"
                      onClick={() =>
                        alert("More post options will be added later.")
                      }
                      className="px-2 text-xl text-gray-500"
                    >
                      ···
                    </button>
                  </div>

                  <img
                    src={post.image}
                    alt={`Post by ${post.username}`}
                    className="max-h-[650px] w-full bg-gray-100 object-cover"
                  />

                  <div className="p-4">
                    <div className="mb-3 flex items-center gap-5">
                      <button
                        onClick={() => toggleLike(post.id)}
                        aria-label={liked ? "Unlike post" : "Like post"}
                        className={`text-3xl transition hover:scale-110 ${
                          liked ? "text-pink-600" : "text-gray-800"
                        }`}
                      >
                        {liked ? "♥" : "♡"}
                      </button>

                      <button
                        aria-label="Comment on post"
                        onClick={() =>
                          alert("Comments will be added in the next step!")
                        }
                        className="text-2xl"
                      >
                        ◯
                      </button>

                      <button
                        aria-label="Share post"
                        onClick={() =>
                          alert("Sharing will be added in the next step!")
                        }
                        className="text-2xl"
                      >
                        ↗
                      </button>
                    </div>

                    <p className="mb-2 text-sm font-bold">
                      {post.likes.toLocaleString()} likes
                    </p>

                    <p className="text-sm leading-6">
                      <span className="mr-2 font-bold">
                        {post.username}
                      </span>
                      {post.caption}
                    </p>

                    <button
                      onClick={() =>
                        alert("Real comments will be added in the next step!")
                      }
                      className="mt-3 text-sm text-gray-400"
                    >
                      View all comments
                    </button>
                  </div>
                </article>
              );
            })}

            {visiblePosts.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
                <p className="font-semibold">No matching posts</p>
                <p className="mt-2 text-sm text-gray-500">
                  Try searching for another username.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Right sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            {/* Actual logged-in user */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-600 font-bold text-white">
                  {(userEmail[0] || "U").toUpperCase()}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {userEmail.split("@")[0]}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {userEmail}
                  </p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="text-xs font-bold text-purple-600 disabled:opacity-50"
              >
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>

            {/* Suggested accounts */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold">Suggested for you</h3>
                <button
                  onClick={() => setActiveTab("Explore")}
                  className="text-xs font-semibold text-purple-600"
                >
                  See all
                </button>
              </div>

              {[
                ["N", "nina.creates", "Design enthusiast"],
                ["K", "karan.explores", "Travel & photography"],
                ["P", "priya.codes", "Developer"],
              ].map(([letter, username, bio]) => (
                <div
                  key={username}
                  className="mb-4 flex items-center justify-between gap-2 last:mb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
                      {letter}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">
                        {username}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {bio}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      alert("Following users will be added in a later step.")
                    }
                    className="text-xs font-bold text-purple-600"
                  >
                    Follow
                  </button>
                </div>
              ))}
            </div>

            {/* Create post promotion */}
            <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 p-5 text-white">
              <p className="text-lg font-bold">
                Your world, connected.
              </p>
              <p className="mt-2 text-sm text-white/85">
                Share your moments. Discover new perspectives. Find your
                people.
              </p>

              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-bold text-purple-700"
              >
                Share a moment
              </button>
            </div>

            <p className="text-xs leading-6 text-gray-400">
              About · Help · Privacy · Terms
              <br />
              © 2026 ConnectSphere
            </p>
          </div>
        </aside>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-gray-200 bg-white px-2 py-3 lg:hidden">
        {[
          ["⌂", "Home"],
          ["⌕", "Search"],
          ["+", "Create"],
          ["♡", "Likes"],
          ["◉", "Profile"],
        ].map(([icon, label]) => (
          <button
            key={label}
            onClick={() => {
              setActiveTab(label);

              if (label === "Create") {
                setShowCreate(true);
              }

              if (label === "Search") {
                document.querySelector("input")?.focus();
              }

              if (label === "Profile") {
                alert(`Logged in as ${userEmail}`);
              }

              if (label === "Likes") {
                alert("Your liked posts will be added in a later step.");
              }
            }}
            className="flex flex-col items-center gap-1 text-gray-700"
          >
            <span className="text-2xl">{icon}</span>
            <span className="text-[10px]">{label}</span>
          </button>
        ))}
      </nav>

      {/* Create post modal */}
      {showCreate && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">Create a post</h2>

              <button
                onClick={() => setShowCreate(false)}
                className="text-2xl text-gray-500"
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>

            <p className="mb-3 text-sm text-gray-500">
              Choose a photo and write a caption. Your post will be saved to Supabase.
            </p>

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-semibold text-gray-700">Post image</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setSelectedImage(event.target.files?.[0] ?? null)}
                className="block w-full rounded-xl border border-gray-200 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-purple-50 file:px-3 file:py-2 file:font-semibold file:text-purple-700"
              />
            </label>

            {selectedImage && (
              <p className="mb-3 truncate text-xs text-gray-500">Selected: {selectedImage.name}</p>
            )}

            {postError && showCreate && (
              <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{postError}</p>
            )}

            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="What would you like to share?"
              rows={4}
              className="w-full resize-none rounded-xl border border-gray-200 p-4 outline-none focus:border-purple-500"
            />

            <button
              onClick={createPost}
              disabled={!caption.trim() || !selectedImage || publishing}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 py-3 font-bold text-white disabled:opacity-50"
            >
              {publishing ? "Publishing..." : "Publish post"}
            </button>

            <p className="mt-3 text-xs text-gray-400">
              Images are uploaded to the public `post` bucket and post details are saved in Supabase.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}