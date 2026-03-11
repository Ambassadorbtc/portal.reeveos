/**
 * BlogManager — blog post management for the website builder dashboard.
 */
import { useState, useEffect, useCallback } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

/* ─── Style tokens ─── */
const btnPrimary = {
  background: '#C9A84C', color: '#fff', border: 'none', borderRadius: 8,
  padding: '8px 16px', fontFamily: 'Figtree, sans-serif', fontWeight: 600,
  fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
}
const btnSecondary = {
  background: '#111', color: '#fff', border: 'none', borderRadius: 8,
  padding: '8px 16px', fontFamily: 'Figtree, sans-serif', fontWeight: 600,
  fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
}
const btnOutline = {
  background: '#fff', color: '#111', border: '1px solid #E5E5E5', borderRadius: 8,
  padding: '8px 16px', fontFamily: 'Figtree, sans-serif', fontWeight: 500,
  fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
}
const inputStyle = {
  width: '100%', padding: '8px 12px', border: '1px solid #E5E5E5', borderRadius: 8,
  fontFamily: 'Figtree, sans-serif', fontSize: 14, color: '#111', outline: 'none',
  boxSizing: 'border-box',
}
const labelStyle = {
  display: 'block', fontFamily: 'Figtree, sans-serif', fontSize: 13,
  fontWeight: 600, color: '#111', marginBottom: 4,
}

/* ─── Icons ─── */
const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" />
  </svg>
)
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
)
const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
)
const IconAI = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const now = new Date(), then = new Date(dateStr)
  const seconds = Math.floor((now - then) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
export default function BlogManager() {
  const { business } = useBusiness()
  const bid = business?.id

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [view, setView] = useState('list') // list | editor
  const [editingPost, setEditingPost] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const fetchPosts = useCallback(async () => {
    if (!bid) return
    try {
      const res = await api.get(`/blog/business/${bid}/posts`)
      setPosts(res.posts || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [bid])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const handleDelete = async (id) => {
    try {
      await api.delete(`/blog/business/${bid}/posts/${id}`)
      setDeleteConfirm(null)
      showToast('Post deleted')
      fetchPosts()
    } catch (err) { setError(err.message); setDeleteConfirm(null) }
  }

  const handleEdit = (post) => {
    setEditingPost(post)
    setView('editor')
  }

  const handleNew = () => {
    setEditingPost(null)
    setView('editor')
  }

  const handleSaved = () => {
    setView('list')
    setEditingPost(null)
    fetchPosts()
  }

  if (!business) {
    return <div style={{ padding: 32, fontFamily: 'Figtree, sans-serif', color: '#666' }}>Loading business...</div>
  }

  const published = posts.filter(p => p.status === 'published').length
  const drafts = posts.filter(p => p.status === 'draft').length

  return (
    <div style={{ padding: 32, fontFamily: 'Figtree, sans-serif', maxWidth: 1100, margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, background: '#111', color: '#fff',
          padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999,
          fontFamily: 'Figtree, sans-serif',
        }}>{toast}</div>
      )}

      {view === 'list' ? (
        <>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: '#111' }}>Blog</h1>
              <p style={{ margin: 0, fontSize: 14, color: '#666' }}>Manage your blog posts</p>
            </div>
            <button onClick={handleNew} style={btnPrimary}><IconPlus /> New Post</button>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Total', value: posts.length },
              { label: 'Published', value: published },
              { label: 'Drafts', value: drafts },
            ].map(s => (
              <div key={s.label} style={{
                background: '#fff', border: '1px solid #E5E5E5', borderRadius: 8,
                padding: '12px 20px', minWidth: 100,
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#111' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 64, color: '#666', fontSize: 14 }}>Loading posts...</div>
          ) : posts.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '64px 32px', border: '1px solid #E5E5E5',
              borderRadius: 12, background: '#fff',
            }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#111', margin: '0 0 6px' }}>No blog posts yet</p>
              <p style={{ fontSize: 14, color: '#666', margin: '0 0 20px' }}>Create your first post to get started.</p>
              <button onClick={handleNew} style={btnPrimary}><IconPlus /> New Post</button>
            </div>
          ) : (
            <div style={{ border: '1px solid #E5E5E5', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Figtree, sans-serif' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E5E5E5' }}>
                    {['Title', 'Status', 'Date', 'Actions'].map(col => (
                      <th key={col} style={{
                        textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600,
                        color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px',
                      }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {posts.map(post => {
                    const isPublished = post.status === 'published'
                    const isScheduled = post.status === 'scheduled'
                    return (
                      <tr key={post.id} style={{ borderBottom: '1px solid #f0f0f0' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500, color: '#111' }}>
                          {post.title}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            display: 'inline-block', fontSize: 12, fontWeight: 600, padding: '3px 10px',
                            borderRadius: 100,
                            background: isPublished ? '#dcfce7' : isScheduled ? '#dbeafe' : '#f3f4f6',
                            color: isPublished ? '#166534' : isScheduled ? '#1e40af' : '#4b5563',
                          }}>
                            {isPublished ? 'Published' : isScheduled ? 'Scheduled' : 'Draft'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#666' }}>
                          {timeAgo(post.published_at || post.created_at)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => handleEdit(post)} title="Edit" style={{
                              background: '#f5f5f5', border: 'none', borderRadius: 6,
                              padding: '6px 8px', cursor: 'pointer', color: '#111',
                              display: 'inline-flex', alignItems: 'center',
                            }}><IconEdit /></button>
                            <button onClick={() => setDeleteConfirm(post.id)} title="Delete" style={{
                              background: '#f5f5f5', border: 'none', borderRadius: 6,
                              padding: '6px 8px', cursor: 'pointer', color: '#dc2626',
                              display: 'inline-flex', alignItems: 'center',
                            }}><IconTrash /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Delete Confirm */}
          {deleteConfirm && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            }} onClick={() => setDeleteConfirm(null)}>
              <div onClick={e => e.stopPropagation()} style={{
                background: '#fff', borderRadius: 12, padding: 32, maxWidth: 400, width: '100%',
                fontFamily: 'Figtree, sans-serif',
              }}>
                <p style={{ fontSize: 15, color: '#111', margin: '0 0 24px', lineHeight: 1.5 }}>
                  Are you sure you want to delete this post? This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setDeleteConfirm(null)} style={btnOutline}>Cancel</button>
                  <button onClick={() => handleDelete(deleteConfirm)} style={{ ...btnSecondary, background: '#dc2626' }}>Delete</button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <BlogEditor
          bid={bid}
          post={editingPost}
          onBack={() => { setView('list'); setEditingPost(null) }}
          onSaved={handleSaved}
          showToast={showToast}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   BLOG EDITOR
   ═══════════════════════════════════════════════ */
function BlogEditor({ bid, post, onBack, onSaved, showToast }) {
  const [title, setTitle] = useState(post?.title || '')
  const [slug, setSlug] = useState(post?.slug || '')
  const [slugEdited, setSlugEdited] = useState(!!post)
  const [content, setContent] = useState(post?.content || '')
  const [excerpt, setExcerpt] = useState(post?.excerpt || '')
  const [featuredImage, setFeaturedImage] = useState(post?.featured_image || '')
  const [tags, setTags] = useState((post?.tags || []).join(', '))
  const [metaTitle, setMetaTitle] = useState(post?.meta_title || '')
  const [metaDesc, setMetaDesc] = useState(post?.meta_description || '')
  const [scheduleDate, setScheduleDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleTitleChange = (val) => {
    setTitle(val)
    if (!slugEdited) setSlug(slugify(val))
  }

  const save = async (status) => {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError(null)
    try {
      const body = {
        title: title.trim(),
        slug: slug.trim() || slugify(title),
        content,
        excerpt,
        featured_image: featuredImage,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        meta_title: metaTitle,
        meta_description: metaDesc,
        status,
      }
      if (post?.id) {
        await api.put(`/blog/business/${bid}/posts/${post.id}`, body)
      } else {
        await api.post(`/blog/business/${bid}/posts`, body)
      }
      showToast(status === 'published' ? 'Post published' : 'Post saved')
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (post?.id) {
      setSaving(true)
      try {
        // Save content first, then publish
        await api.put(`/blog/business/${bid}/posts/${post.id}`, {
          title: title.trim(), slug, content, excerpt, featured_image: featuredImage,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          meta_title: metaTitle, meta_description: metaDesc,
        })
        await api.post(`/blog/business/${bid}/posts/${post.id}/publish`)
        showToast('Post published')
        onSaved()
      } catch (err) { setError(err.message) } finally { setSaving(false) }
    } else {
      save('published')
    }
  }

  const handleSchedule = async () => {
    if (!scheduleDate) { setError('Select a date to schedule'); return }
    setSaving(true)
    setError(null)
    try {
      let postId = post?.id
      if (!postId) {
        const res = await api.post(`/blog/business/${bid}/posts`, {
          title: title.trim(), slug: slug.trim() || slugify(title), content, excerpt,
          featured_image: featuredImage, tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          meta_title: metaTitle, meta_description: metaDesc, status: 'draft',
        })
        postId = res.id
      } else {
        await api.put(`/blog/business/${bid}/posts/${postId}`, {
          title: title.trim(), slug, content, excerpt, featured_image: featuredImage,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          meta_title: metaTitle, meta_description: metaDesc,
        })
      }
      await api.post(`/blog/business/${bid}/posts/${postId}/schedule`, { publish_at: scheduleDate })
      showToast('Post scheduled')
      onSaved()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const handleAIWrite = async () => {
    if (!title.trim()) { setError('Enter a title first for AI to write about'); return }
    setAiLoading(true)
    setError(null)
    try {
      const res = await api.post(`/website/business/${bid}/ai/blog`, { topic: title.trim() })
      if (res.content) setContent(res.content)
      if (res.excerpt) setExcerpt(res.excerpt)
      if (res.meta_description) setMetaDesc(res.meta_description)
      showToast('AI content generated')
    } catch (err) {
      setError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ ...btnOutline, padding: '6px 12px' }}><IconBack /></button>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111' }}>
          {post ? 'Edit Post' : 'New Post'}
        </h1>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        {/* Main column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <input
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Post title"
              style={{ ...inputStyle, fontSize: 22, fontWeight: 700, padding: '12px 16px' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Slug</label>
            <input
              value={slug}
              onChange={e => { setSlugEdited(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')) }}
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13 }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Content</label>
              <button onClick={handleAIWrite} disabled={aiLoading} style={{
                ...btnOutline, fontSize: 12, padding: '4px 10px',
                opacity: aiLoading ? 0.6 : 1,
              }}>
                <IconAI /> {aiLoading ? 'Generating...' : 'AI Write'}
              </button>
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your post content (HTML supported)..."
              style={{ ...inputStyle, minHeight: 400, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>
          <div>
            <label style={labelStyle}>Excerpt</label>
            <textarea
              value={excerpt}
              onChange={e => setExcerpt(e.target.value)}
              placeholder="A short summary of the post..."
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Actions */}
          <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#111' }}>Publish</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => save('draft')} disabled={saving} style={{ ...btnOutline, width: '100%', justifyContent: 'center' }}>
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button onClick={handlePublish} disabled={saving} style={{ ...btnPrimary, width: '100%', justifyContent: 'center' }}>
                {saving ? 'Publishing...' : 'Publish'}
              </button>
              <div style={{ borderTop: '1px solid #E5E5E5', paddingTop: 8, marginTop: 4 }}>
                <label style={{ ...labelStyle, fontSize: 12 }}>Schedule for</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={e => setScheduleDate(e.target.value)}
                    style={{ ...inputStyle, flex: 1, fontSize: 12 }}
                  />
                  <button onClick={handleSchedule} disabled={saving || !scheduleDate} style={{
                    ...btnSecondary, fontSize: 12, padding: '6px 10px',
                    opacity: !scheduleDate ? 0.5 : 1,
                  }}>Schedule</button>
                </div>
              </div>
            </div>
          </div>

          {/* Featured Image */}
          <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, padding: 20 }}>
            <label style={labelStyle}>Featured Image URL</label>
            <input
              value={featuredImage}
              onChange={e => setFeaturedImage(e.target.value)}
              placeholder="https://..."
              style={inputStyle}
            />
            {featuredImage && (
              <img src={featuredImage} alt="Preview" style={{
                width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginTop: 8,
              }} />
            )}
          </div>

          {/* Tags */}
          <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, padding: 20 }}>
            <label style={labelStyle}>Tags</label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
              style={inputStyle}
            />
          </div>

          {/* SEO */}
          <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#111' }}>SEO</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Meta Title</label>
              <input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} style={inputStyle} placeholder="Page title for search engines" />
            </div>
            <div>
              <label style={labelStyle}>Meta Description</label>
              <textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} placeholder="Brief description for search results..." />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
